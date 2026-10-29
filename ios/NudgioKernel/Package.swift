// swift-tools-version:5.9
//
// NudgioKernel: the iPhone reliability core (ADR-023, plan phase F6).
//
// Everything that decides what an alarm is lives here, in plain Swift over
// Foundation, so it builds and is tested on Linux (`swift test`) as well as on
// an iOS simulator. The AlarmKit, Photos and UIKit adapters sit behind
// `#if canImport(...)` in `Sources/NudgioKernel/Apple/`, compiled only for
// iOS. The Flutter Runner links this package and forwards `nudgio/host`
// calls to `HostDispatcher`.
import PackageDescription

let package = Package(
    name: "NudgioKernel",
    platforms: [.iOS("26.0"), .macOS(.v14)],
    products: [
        .library(name: "NudgioKernel", targets: ["NudgioKernel"]),
    ],
    targets: [
        .target(name: "NudgioKernel"),
        .testTarget(name: "NudgioKernelTests", dependencies: ["NudgioKernel"]),
    ],
    swiftLanguageVersions: [.v5]
)
