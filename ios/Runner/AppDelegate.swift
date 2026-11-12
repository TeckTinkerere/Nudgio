import AppIntents
import Flutter
import NudgioKernel
import UIKit

/// The iPhone UI host (ADR-023): the Flutter engine plus `NudgioKernel`.
///
/// `nudgio/host` calls go to `HostDispatcher`; `nudgio/events` carries
/// progress events. AlarmKit rings, stops and snoozes with no Flutter engine
/// at all; only the alarm's Open button reaches back into the app, through
/// `OpenReminderIntent` below.
@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Re-arm monthly, yearly and custom alarms, and anything a pause or skip
    // held back, whenever the app comes to the front. A notification rather
    // than a delegate method: with UIScene the app delegate is not told.
    NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
    ) { _ in
      Task { await NudgioHost.shared.kernel.reconcile() }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    guard let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "NudgioHost") else { return }
    NudgioHost.shared.attach(messenger: registrar.messenger())
  }
}

/// Owns the one kernel for the process and its channels.
final class NudgioHost: NSObject, FlutterStreamHandler {
  static let shared = NudgioHost()

  private var eventSink: FlutterEventSink?
  // Built eagerly in init (`static let` is thread-safe), never `lazy`: the
  // Open/Stop intents and didBecomeActive can reach this at the same moment
  // on a cold launch, and a lazy var could build two kernels whose cached
  // states overwrite each other.
  let kernel: NudgioKernel
  private let dispatcher: HostDispatcher
  /// The previous host call; each new one awaits it so calls reach the kernel
  /// in the order Dart sent them. Touched only on the main thread.
  private var tail: Task<Void, Never>?

  private override init() {
    let events = EventRelay()
    kernel = NudgioHost.makeKernel(events: events)
    dispatcher = HostDispatcher(kernel: kernel)
    super.init()
    events.host = self
  }

  /// Breaks the init cycle: the kernel needs an event sink before `self` exists.
  private final class EventRelay: @unchecked Sendable {
    weak var host: NudgioHost?
  }

  private static func makeKernel(events relay: EventRelay) -> NudgioKernel {
    let fileManager = FileManager.default
    let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("Nudgio", isDirectory: true)
    let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("staging", isDirectory: true)
    let platform = ApplePlatform()
    let info = Bundle.main.infoDictionary
    #if DEBUG
    let variant = "debug"
    #else
    let variant = "release"
    #endif
    return NudgioKernel(
      store: FileKernelStore(directory: support),
      directories: KernelDirectories(root: support, staging: caches),
      alarms: AlarmKitScheduler(
        makeOpenIntent: { OpenReminderIntent(alarmID: $0) },
        makeStopIntent: { StopReminderIntent(alarmID: $0) }
      ),
      platform: platform,
      environment: KernelEnvironment(
        appVersion: info?["CFBundleShortVersionString"] as? String ?? "0",
        buildVariant: variant
      ),
      events: { event, payload in
        DispatchQueue.main.async { relay.host?.eventSink?(["event": event, "payload": payload]) }
      }
    )
  }

  func attach(messenger: FlutterBinaryMessenger) {
    let methods = FlutterMethodChannel(name: HostDispatcher.hostChannel, binaryMessenger: messenger)
    methods.setMethodCallHandler { [weak self] call, result in
      guard let self else { return result(FlutterMethodNotImplemented) }
      let dispatcher = self.dispatcher
      let previous = self.tail
      self.tail = Task {
        await previous?.value
        do {
          let value = try await dispatcher.handle(method: call.method, arguments: call.arguments)
          await MainActor.run { result(value) }
        } catch let error as HostError {
          await MainActor.run { result(FlutterError(code: error.code, message: error.messageKey, details: error.envelope)) }
        } catch {
          let safe = HostError(code: "MR_INTERNAL_FAILED_SAFE", messageKey: "error.unexpected", category: .internal, field: call.method)
          await MainActor.run { result(FlutterError(code: safe.code, message: safe.messageKey, details: safe.envelope)) }
        }
      }
    }
    FlutterEventChannel(name: HostDispatcher.eventChannel, binaryMessenger: messenger).setStreamHandler(self)
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    eventSink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    eventSink = nil
    return nil
  }
}

/// The alarm's Open button (media reminders): stops the alert, records which
/// reminder to show, and opens the app, where Dart drains it with
/// `takePendingMediaOpen` and plays only on an explicit Play (AGENTS.md).
/// Lives in the app target because App Intents metadata is read from it.
struct OpenReminderIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Open Nudgio reminder"
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Alarm identifier") var alarmID: String

  init() { alarmID = "" }
  init(alarmID: String) { self.alarmID = alarmID }

  func perform() async throws -> some IntentResult {
    guard UUID(uuidString: alarmID) != nil else { return .result() }
    await NudgioHost.shared.kernel.recordOpen(alarmId: alarmID.lowercased())
    return .result()
  }
}

/// The alarm's system Stop: runs in the background (no app launch), records
/// the dismissal and re-arms the reminder's next moment.
struct StopReminderIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Nudgio reminder"
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Alarm identifier") var alarmID: String

  init() { alarmID = "" }
  init(alarmID: String) { self.alarmID = alarmID }

  func perform() async throws -> some IntentResult {
    guard UUID(uuidString: alarmID) != nil else { return .result() }
    await NudgioHost.shared.kernel.recordStop(alarmId: alarmID.lowercased())
    return .result()
  }
}
