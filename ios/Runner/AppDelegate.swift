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
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    guard let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "NudgioHost") else { return }
    NudgioHost.shared.attach(messenger: registrar.messenger())
  }

  override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    // Re-arm monthly, yearly and custom alarms, and anything a pause or skip
    // held back, whenever the app comes to the front.
    Task { await NudgioHost.shared.kernel.reconcile() }
  }
}

/// Owns the one kernel for the process and its channels.
final class NudgioHost: NSObject, FlutterStreamHandler {
  static let shared = NudgioHost()

  private var eventSink: FlutterEventSink?
  private(set) lazy var kernel: NudgioKernel = makeKernel()
  private lazy var dispatcher = HostDispatcher(kernel: kernel)

  private func makeKernel() -> NudgioKernel {
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
      alarms: AlarmKitScheduler(makeOpenIntent: { OpenReminderIntent(alarmID: $0) }),
      platform: platform,
      environment: KernelEnvironment(
        appVersion: info?["CFBundleShortVersionString"] as? String ?? "0",
        buildVariant: variant
      ),
      events: { [weak self] event, payload in
        DispatchQueue.main.async { self?.eventSink?(["event": event, "payload": payload]) }
      }
    )
  }

  func attach(messenger: FlutterBinaryMessenger) {
    let methods = FlutterMethodChannel(name: HostDispatcher.hostChannel, binaryMessenger: messenger)
    methods.setMethodCallHandler { [weak self] call, result in
      guard let self else { return result(FlutterMethodNotImplemented) }
      let dispatcher = self.dispatcher
      Task {
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
