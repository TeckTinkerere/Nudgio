#if os(iOS)
import AVFoundation
import Foundation
import Photos
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/// `MediaPlatform` over UIKit and Photos. Every picker copies into the
/// kernel's staging directory before its callback returns, because the
/// system's temporary URLs do not outlive it (the iPhone counterpart of
/// "pass it to beginMediaImport promptly", ADR-011).
///
/// Privacy: no Photos read permission is ever requested. PHPicker runs out of
/// process and returns only what was chosen; saving is add-only.
public final class ApplePlatform: MediaPlatform {
    public init() {}

    // MARK: Pickers

    public func pick(mimeTypes: [String], maxItems: Int, stagingDirectory: URL) async -> [StagedFile] {
        let types = mimeTypes.map(Self.contentType)
        let visualOnly = !types.isEmpty && types.allSatisfy { $0.conforms(to: .image) || $0.conforms(to: .movie) }
        return await withCheckedContinuation { continuation in
            Task { @MainActor in
                guard let presenter = Self.topViewController() else { return continuation.resume(returning: []) }
                if visualOnly {
                    var configuration = PHPickerConfiguration()
                    configuration.selectionLimit = maxItems
                    let wantsImages = types.contains { $0.conforms(to: .image) }
                    let wantsVideos = types.contains { $0.conforms(to: .movie) }
                    configuration.filter = wantsImages && wantsVideos ? .any(of: [.images, .videos]) : (wantsImages ? .images : .videos)
                    let picker = PHPickerViewController(configuration: configuration)
                    let delegate = PhotoPickerDelegate(staging: stagingDirectory) { continuation.resume(returning: $0) }
                    picker.delegate = delegate
                    objc_setAssociatedObject(picker, &Self.delegateKey, delegate, .OBJC_ASSOCIATION_RETAIN)
                    presenter.present(picker, animated: true)
                } else {
                    let picker = UIDocumentPickerViewController(forOpeningContentTypes: types.isEmpty ? [.item] : types, asCopy: true)
                    picker.allowsMultipleSelection = maxItems > 1
                    let delegate = DocumentPickerDelegate(staging: stagingDirectory, limit: maxItems) { continuation.resume(returning: $0) }
                    picker.delegate = delegate
                    objc_setAssociatedObject(picker, &Self.delegateKey, delegate, .OBJC_ASSOCIATION_RETAIN)
                    presenter.present(picker, animated: true)
                }
            }
        }
    }

    private static var delegateKey: UInt8 = 0

    static func contentType(forMimeType mime: String) -> UTType {
        switch mime.lowercased() {
        case "image/*": return .image
        case "video/*": return .movie
        case "audio/*": return .audio
        case "text/plain": return .plainText
        default: return UTType(mimeType: mime) ?? .item
        }
    }

    private static func contentType(_ mime: String) -> UTType { contentType(forMimeType: mime) }

    /// Moves [source] into [staging] under a fresh name, keeping its extension.
    static func stage(_ source: URL, into staging: URL, displayName: String?) -> StagedFile? {
        try? FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
        let ext = source.pathExtension
        let destination = staging.appendingPathComponent(UUID().uuidString.lowercased() + (ext.isEmpty ? "" : ".\(ext)"))
        do {
            try FileManager.default.copyItem(at: source, to: destination)
        } catch {
            return nil
        }
        let type = UTType(filenameExtension: ext)
        let size = (try? FileManager.default.attributesOfItem(atPath: destination.path)[.size] as? NSNumber)?.int64Value
        return StagedFile(url: destination, displayName: displayName ?? source.lastPathComponent,
                          mimeType: type?.preferredMIMEType ?? "application/octet-stream", sizeBytes: size)
    }

    @MainActor static func topViewController() -> UIViewController? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    // MARK: Probe

    public func probe(file: URL, kind: MediaKind) async -> MediaProbe {
        switch kind {
        case .image:
            guard let image = UIImage(contentsOfFile: file.path) else { return MediaProbe() }
            let thumbnail = image.preparingThumbnail(of: Self.thumbnailSize(for: image.size))
            return MediaProbe(thumbnailJPEG: thumbnail?.jpegData(compressionQuality: 0.8),
                              widthPx: Int(image.size.width * image.scale), heightPx: Int(image.size.height * image.scale))
        case .video:
            let asset = AVURLAsset(url: file)
            var probe = MediaProbe()
            if let duration = try? await asset.load(.duration), duration.isNumeric {
                probe.durationMs = Int(duration.seconds * 1000)
            }
            if let track = try? await asset.loadTracks(withMediaType: .video).first,
               let geometry = try? await track.load(.naturalSize, .preferredTransform) {
                let oriented = geometry.0.applying(geometry.1)
                probe.widthPx = Int(abs(oriented.width))
                probe.heightPx = Int(abs(oriented.height))
            }
            let generator = AVAssetImageGenerator(asset: asset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 512, height: 512)
            if let frame = try? await generator.image(at: .zero) {
                probe.thumbnailJPEG = UIImage(cgImage: frame.image).jpegData(compressionQuality: 0.8)
            }
            return probe
        case .audio:
            let asset = AVURLAsset(url: file)
            guard let duration = try? await asset.load(.duration), duration.isNumeric else { return MediaProbe() }
            return MediaProbe(durationMs: Int(duration.seconds * 1000))
        case .text:
            return MediaProbe()
        }
    }

    static func thumbnailSize(for size: CGSize) -> CGSize {
        let scale = min(1, 512 / max(size.width, size.height, 1))
        return CGSize(width: size.width * scale, height: size.height * scale)
    }

    // MARK: Share, Photos, Settings

    public func share(files: [URL]) async -> Bool {
        await MainActor.run {
            guard let presenter = Self.topViewController() else { return false }
            let sheet = UIActivityViewController(activityItems: files, applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = presenter.view
            presenter.present(sheet, animated: true)
            return true
        }
    }

    public func saveToPhotos(file: URL, kind: MediaKind) async -> Bool {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { return false }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                let options = PHAssetResourceCreationOptions()
                options.shouldMoveFile = false
                request.addResource(with: kind == .video ? .video : .photo, fileURL: file, options: options)
            }
            return true
        } catch {
            return false
        }
    }

    public func openSettings() async -> Bool {
        await MainActor.run {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { return false }
            UIApplication.shared.open(url)
            return true
        }
    }
}

private final class PhotoPickerDelegate: NSObject, PHPickerViewControllerDelegate {
    private let staging: URL
    private var completion: (([StagedFile]) -> Void)?

    init(staging: URL, completion: @escaping ([StagedFile]) -> Void) {
        self.staging = staging
        self.completion = completion
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        let group = DispatchGroup()
        let lock = NSLock()
        var staged: [Int: StagedFile] = [:]
        for (index, result) in results.enumerated() {
            let provider = result.itemProvider
            guard let typeId = provider.registeredTypeIdentifiers.first(where: { id in
                guard let type = UTType(id) else { return false }
                return type.conforms(to: .movie) || type.conforms(to: .image)
            }) else { continue }
            group.enter()
            provider.loadFileRepresentation(forTypeIdentifier: typeId) { [staging] url, _ in
                defer { group.leave() }
                guard let url else { return }
                let name = provider.suggestedName.map { name in url.pathExtension.isEmpty ? name : "\(name).\(url.pathExtension)" }
                if let file = ApplePlatform.stage(url, into: staging, displayName: name) {
                    lock.lock(); staged[index] = file; lock.unlock()
                }
            }
        }
        group.notify(queue: .main) { [weak self] in
            self?.completion?(staged.keys.sorted().compactMap { staged[$0] })
            self?.completion = nil
        }
    }
}

private final class DocumentPickerDelegate: NSObject, UIDocumentPickerDelegate {
    private let staging: URL
    private let limit: Int
    private var completion: (([StagedFile]) -> Void)?

    init(staging: URL, limit: Int, completion: @escaping ([StagedFile]) -> Void) {
        self.staging = staging
        self.limit = limit
        self.completion = completion
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let files = urls.prefix(limit).compactMap { ApplePlatform.stage($0, into: staging, displayName: $0.lastPathComponent) }
        completion?(files)
        completion = nil
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        completion?([])
        completion = nil
    }
}
#endif
