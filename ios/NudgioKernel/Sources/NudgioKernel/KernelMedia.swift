import Foundation

/// Media library and folders: the iPhone side of `MediaImporter`,
/// `MediaLibraryService` and `LibraryService`. App-owned copies are the
/// source of truth (ADR-010): a reminder never depends on the original.
extension NudgioKernel {
    static let maxImportBytes: Int64 = 4 * 1024 * 1024 * 1024
    /// Leave this much free after an import, as the Android storage reserve.
    static let storageReserveBytes: Int64 = 200 * 1024 * 1024
    static let copyChunkBytes = 1024 * 1024
    static let stagedPrefix = "staged:"

    // MARK: Pickers

    public func pick(mimeTypes: [String], maxItems: Int) async -> [Any] {
        try? FileManager.default.createDirectory(at: directories.staging, withIntermediateDirectories: true)
        let files = await platform.pick(mimeTypes: mimeTypes, maxItems: min(max(maxItems, 1), 20),
                                        stagingDirectory: directories.staging)
        return files.map(Self.pickedWire)
    }

    static func pickedWire(_ file: StagedFile) -> WireMap {
        [
            "uriToken": stagedPrefix + file.url.lastPathComponent,
            "displayName": wireNull(file.displayName),
            "mimeType": file.mimeType,
            "sizeBytes": wireNull(file.sizeBytes.map { String($0) }),
        ]
    }

    /// A token from `pick` back to its staged file. Only a bare file name in
    /// the staging directory resolves: no paths, no traversal.
    func stagedURL(_ token: String) throws -> URL {
        guard token.hasPrefix(Self.stagedPrefix) else { throw HostError.mediaUnavailable("sourceUri") }
        let name = String(token.dropFirst(Self.stagedPrefix.count))
        guard !name.isEmpty, !name.contains("/"), !name.contains("\\"), name != "..", name != "." else {
            throw HostError.mediaUnavailable("sourceUri")
        }
        let url = directories.staging.appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: url.path) else { throw HostError.mediaUnavailable("sourceUri") }
        return url
    }

    static func kind(forMimeType mime: String) -> MediaKind? {
        let lower = mime.lowercased()
        if lower.hasPrefix("video/") { return .video }
        if lower.hasPrefix("audio/") { return .audio }
        if lower.hasPrefix("image/") { return .image }
        if lower == "text/plain" { return .text }
        return nil
    }

    // MARK: Import

    /// MR-05 "Import transaction": copy in bounded chunks while hashing, then
    /// probe, then insert. The copy runs off the actor so other host calls,
    /// including `cancelOperation`, keep being answered.
    public func importMedia(_ request: WireReader, replacing replacedId: String? = nil) async throws -> WireMap {
        guard let token = request.string("sourceUri"), !token.isEmpty else { throw HostError.validation("sourceUri") }
        if let replacedId, try self.state().media.first(where: { $0.id == replacedId }) == nil {
            throw HostError.mediaUnavailable("id")
        }
        let source = try stagedURL(token)
        let existingMime = try replacedId.flatMap { id in try self.state().media.first { $0.id == id }?.mimeType }
        let mimeType = request.string("mimeType") ?? existingMime ?? "application/octet-stream"
        guard let kind = Self.kind(forMimeType: mimeType) else { throw HostError.unsupportedType() }
        let sourceSize = (try? FileManager.default.attributesOfItem(atPath: source.path)[.size] as? NSNumber)?.int64Value
        if let sourceSize, sourceSize > Self.maxImportBytes { throw HostError.storageInsufficient("tooLarge") }
        try checkFreeSpace(needed: sourceSize ?? 0)

        try FileManager.default.createDirectory(at: directories.media, withIntermediateDirectories: true)
        let id = replacedId ?? UUID().uuidString.lowercased()
        let ext = source.pathExtension.isEmpty ? "bin" : source.pathExtension.lowercased()
        // A fresh key even when replacing, so the old file survives a failed copy.
        let storageKey = "\(id)-\(UUID().uuidString.prefix(8).lowercased()).\(ext)"
        let partial = directories.media.appendingPathComponent(storageKey + ".part")
        let operationId = UUID().uuidString.lowercased()
        defer { operations.clear(operationId) }

        let copied: (size: Int64, sha256: String, sequence: Int)
        do {
            copied = try await Self.copyAndHash(from: source, to: partial, total: sourceSize, operationId: operationId,
                                                registry: operations, events: events)
        } catch {
            try? FileManager.default.removeItem(at: partial)
            if error is CancellationError { throw HostError(code: "MR_VALIDATION_FAILED", messageKey: "error.unexpected", category: .internal, field: "cancelled") }
            if let hostError = error as? HostError { throw hostError }
            throw HostError.mediaUnavailable("sourceUnreadable")
        }

        var current = try state()
        // Duplicate-hash reuse (Android lesson): the same bytes are one asset.
        if replacedId == nil, let duplicate = current.media.first(where: { $0.sha256 == copied.sha256 }),
           fileExists(duplicate.storageKey, in: directories.media) {
            try? FileManager.default.removeItem(at: partial)
            try? FileManager.default.removeItem(at: source)
            return mediaDetailWire(duplicate, in: current)
        }

        let final = directories.media.appendingPathComponent(storageKey)
        try FileManager.default.moveItem(at: partial, to: final)
        Self.emit(events, operationId: operationId, phase: "creating_preview", completed: copied.size, total: copied.size,
                  sequence: copied.sequence + 1)
        let probe = await platform.probe(file: final, kind: kind)
        var thumbnailKey: String?
        if let jpeg = probe.thumbnailJPEG {
            try? FileManager.default.createDirectory(at: directories.thumbnails, withIntermediateDirectories: true)
            let key = "\(id)-\(UUID().uuidString.prefix(8).lowercased()).jpg"
            if (try? jpeg.write(to: directories.thumbnails.appendingPathComponent(key), options: Data.WritingOptions.atomic)) != nil { thumbnailKey = key }
        }

        let title = request.string("displayName").map { NSString(string: $0).deletingPathExtension }?.nonEmpty
        var record: MediaRecord
        if let index = current.media.firstIndex(where: { $0.id == replacedId }) {
            record = current.media[index]
            let oldKeys = (record.storageKey, record.thumbnailKey)
            record.mimeType = mimeType
            record.kind = kind
            record.sizeBytes = copied.size
            record.sha256 = copied.sha256
            record.storageKey = storageKey
            record.thumbnailKey = thumbnailKey
            record.durationMs = probe.durationMs
            record.widthPx = probe.widthPx
            record.heightPx = probe.heightPx
            record.updatedAt = now
            record.entityVersion += 1
            current.media[index] = record
            try commit(current)
            try? FileManager.default.removeItem(at: directories.media.appendingPathComponent(oldKeys.0))
            if let thumb = oldKeys.1 { try? FileManager.default.removeItem(at: directories.thumbnails.appendingPathComponent(thumb)) }
        } else {
            record = MediaRecord(
                id: id, kind: kind, title: title ?? "Untitled", notes: nil, mimeType: mimeType, sizeBytes: copied.size,
                sha256: copied.sha256, storageKey: storageKey, thumbnailKey: thumbnailKey, durationMs: probe.durationMs,
                widthPx: probe.widthPx, heightPx: probe.heightPx, createdAt: now, updatedAt: now, entityVersion: 1
            )
            current.media.append(record)
            try commit(current)
        }
        try? FileManager.default.removeItem(at: source)
        Self.emit(events, operationId: operationId, phase: "ready", completed: copied.size, total: copied.size,
                  sequence: copied.sequence + 2)
        await reconcile()
        return mediaDetailWire(record, in: try self.state())
    }

    func checkFreeSpace(needed: Int64) throws {
        #if os(iOS)
        let values = try? directories.root.deletingLastPathComponent()
            .resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        if let available = values?.volumeAvailableCapacityForImportantUsage, available - needed < Self.storageReserveBytes {
            throw HostError.storageInsufficient("storage")
        }
        #endif
    }

    static func copyAndHash(from source: URL, to destination: URL, total: Int64?, operationId: String,
                            registry: OperationRegistry, events: HostEventSink) async throws -> (size: Int64, sha256: String, sequence: Int) {
        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let input = try FileHandle(forReadingFrom: source)
        let output = try FileHandle(forWritingTo: destination)
        defer {
            try? input.close()
            try? output.close()
        }
        var hasher = SHA256Hasher()
        var size: Int64 = 0
        var sequence = 1
        emit(events, operationId: operationId, phase: "copying", completed: 0, total: total, sequence: sequence)
        while true {
            if registry.isCancelled(operationId) || Task.isCancelled { throw CancellationError() }
            guard let chunk = try input.read(upToCount: copyChunkBytes), !chunk.isEmpty else { break }
            size += Int64(chunk.count)
            if size > maxImportBytes { throw HostError.storageInsufficient("tooLarge") }
            hasher.update(chunk)
            try output.write(contentsOf: chunk)
            sequence += 1
            emit(events, operationId: operationId, phase: "copying", completed: size, total: total, sequence: sequence)
            await Task.yield()
        }
        try output.synchronize()
        sequence += 1
        emit(events, operationId: operationId, phase: "checking", completed: size, total: size, sequence: sequence)
        return (size, hasher.finalize(), sequence)
    }

    static func emit(_ events: HostEventSink, operationId: String, phase: String, completed: Int64?, total: Int64?, sequence: Int) {
        var payload: WireMap = [
            "operationId": operationId, "kind": "import", "phase": phase, "cancellable": true,
            "sequence": String(sequence), "correlationId": UUID().uuidString.lowercased(),
        ]
        if let completed { payload["completedUnits"] = String(completed) }
        if let total { payload["totalUnits"] = String(total) }
        events("operationProgress", payload)
    }

    // MARK: Library reads and edits

    public func listMedia(_ query: WireReader) throws -> WireMap {
        let state = try state()
        let sort = query.string("sort") ?? "recent"
        guard ["recent", "name", "mostScheduled", "size"].contains(sort) else { throw HostError.validation("sort") }
        var items = state.media
        switch query.string("location") {
        case "unsorted": items = items.filter { state.memberships[$0.id] == nil }
        case "folder":
            let folder = query.string("folderId")
            items = items.filter { state.memberships[$0.id] == folder }
        default: break
        }
        if let kinds = query.strings("kinds"), !kinds.isEmpty { items = items.filter { kinds.contains($0.kind.rawValue) } }
        if let search = query.string("search")?.trimmingCharacters(in: .whitespaces).lowercased(), !search.isEmpty {
            items = items.filter { $0.title.lowercased().contains(search) }
        }
        if query.bool("onlyMissing") == true { items = items.filter { !fileExists($0.storageKey, in: directories.media) } }
        let used = Set(state.reminders.compactMap(\.mediaId))
        if query.bool("onlyUnused") == true { items = items.filter { !used.contains($0.id) } }
        let counts = Dictionary(grouping: state.reminders.filter(\.enabledIntent).compactMap(\.mediaId), by: { $0 }).mapValues(\.count)
        switch sort {
        case "name": items.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case "mostScheduled": items.sort { (counts[$0.id] ?? 0, $0.createdAt) > (counts[$1.id] ?? 0, $1.createdAt) }
        case "size": items.sort { $0.sizeBytes > $1.sizeBytes }
        default: items.sort { $0.createdAt > $1.createdAt }
        }
        let offset = max(query.int("offset") ?? 0, 0)
        let limit = min(max(query.int("limit") ?? 60, 1), 500)
        let page = items.dropFirst(offset).prefix(limit)
        return [
            "items": page.map { mediaSummaryWire($0, in: state) },
            "total": items.count,
            "offset": offset,
            "hasMore": offset + page.count < items.count,
        ]
    }

    public func media(_ id: String) throws -> WireMap {
        let state = try state()
        guard let media = state.media.first(where: { $0.id == id }) else { throw HostError.mediaUnavailable("id") }
        return mediaDetailWire(media, in: state)
    }

    /// MR-03 "Edit details": absent means "leave alone"; empty notes clears.
    public func updateMedia(_ request: WireReader) throws -> WireMap {
        var state = try state()
        guard let id = request.string("id"), let index = state.media.firstIndex(where: { $0.id == id }) else {
            throw HostError.mediaUnavailable("id")
        }
        if request.has("title") {
            guard let title = request.string("title")?.trimmingCharacters(in: .whitespacesAndNewlines), (1...160).contains(title.count) else {
                throw HostError.validation("title")
            }
            state.media[index].title = title
        }
        if request.has("notes") {
            state.media[index].notes = request.string("notes")?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
        }
        state.media[index].updatedAt = now
        state.media[index].entityVersion += 1
        try commit(state)
        return mediaDetailWire(state.media[index], in: state)
    }

    /// MR-03 "Delete": attached reminders are deleted when asked, otherwise disabled.
    public func deleteMedia(_ request: WireReader) async throws -> WireMap {
        var state = try state()
        guard let id = request.string("id") else { throw HostError.validation("id") }
        guard let media = state.media.first(where: { $0.id == id }) else { throw HostError.mediaUnavailable("id") }
        if request.bool("cascadeDeleteReminders") == true {
            let removed = Set(state.reminders.filter { $0.mediaId == id }.map(\.id))
            state.reminders.removeAll { removed.contains($0.id) }
            state.occurrences.removeAll { removed.contains($0.reminderId) }
        } else {
            for index in state.reminders.indices where state.reminders[index].mediaId == id {
                state.reminders[index].enabledIntent = false
                state.reminders[index].entityVersion += 1
            }
        }
        state.media.removeAll { $0.id == id }
        state.memberships.removeValue(forKey: id)
        try commit(state)
        try? FileManager.default.removeItem(at: directories.media.appendingPathComponent(media.storageKey))
        if let thumb = media.thumbnailKey { try? FileManager.default.removeItem(at: directories.thumbnails.appendingPathComponent(thumb)) }
        await reconcile()
        return ["status": "ok", "affectedCount": 1]
    }

    public func storageUsage() throws -> WireMap {
        let state = try state()
        let used = Set(state.reminders.compactMap(\.mediaId))
        let present = state.media.filter { fileExists($0.storageKey, in: directories.media) }
        let unused = state.media.filter { !used.contains($0.id) }
        return [
            "itemCount": state.media.count,
            "totalBytes": String(present.reduce(Int64(0)) { $0 + $1.sizeBytes }),
            "unavailableCount": state.media.count - present.count,
            "unusedCount": unused.count,
            "unusedBytes": String(unused.reduce(Int64(0)) { $0 + $1.sizeBytes }),
        ]
    }

    /// Media and whole folders (with "unsorted" as the virtual album) to files.
    func selection(mediaIds: [String], folderIds: [String], in state: KernelState) -> [MediaRecord] {
        let folderSet = Set(folderIds)
        let childFolders = Set(state.folders.filter { $0.parentId.map(folderSet.contains) ?? false }.map(\.id))
        let wanted = Set(mediaIds)
        return state.media.filter { media in
            if wanted.contains(media.id) { return true }
            if let folder = state.memberships[media.id] { return folderSet.contains(folder) || childFolders.contains(folder) }
            return folderSet.contains("unsorted")
        }.filter { fileExists($0.storageKey, in: directories.media) }
    }

    /// The share sheet with the real files. iOS shares several files natively,
    /// so nothing is zipped as Android has to.
    public func share(mediaIds: [String], folderIds: [String]) async throws -> WireMap {
        let files = selection(mediaIds: mediaIds, folderIds: folderIds, in: try state())
            .map { directories.media.appendingPathComponent($0.storageKey) }
        guard !files.isEmpty else { throw HostError.mediaUnavailable("ids") }
        guard await platform.share(files: files) else { throw HostError.failedSafe("share") }
        return ["status": "ok", "affectedCount": files.count]
    }

    public func saveSelectionToPhotos(mediaIds: [String], folderIds: [String]) async throws -> WireMap {
        var saved = 0, failed = 0, unsupported = 0
        for media in selection(mediaIds: mediaIds, folderIds: folderIds, in: try state()) {
            guard media.kind == .image || media.kind == .video else { unsupported += 1; continue }
            if await platform.saveToPhotos(file: directories.media.appendingPathComponent(media.storageKey), kind: media.kind) {
                saved += 1
            } else {
                failed += 1
            }
        }
        return ["status": "ok", "savedCount": saved, "alreadySavedCount": 0, "failedCount": failed, "unsupportedCount": unsupported]
    }

    public func saveCopyToPhotos(_ id: String) async throws -> WireMap {
        guard let media = try state().media.first(where: { $0.id == id }), fileExists(media.storageKey, in: directories.media) else {
            throw HostError.mediaUnavailable("id")
        }
        guard media.kind == .image || media.kind == .video else { return ["status": "limited", "affectedCount": 0] }
        guard await platform.saveToPhotos(file: directories.media.appendingPathComponent(media.storageKey), kind: media.kind) else {
            throw HostError(code: "MR_STORAGE_WRITE_FAILED", messageKey: "error.storageWriteFailed", category: .storage)
        }
        return ["status": "ok", "affectedCount": 1]
    }

    // MARK: Folders (`libraryCommand`)

    /// The folder command bus, JSON in and out as `LibraryService.command`:
    /// every mutation names the revision the user saw and a command id, so a
    /// retry is answered from the receipt instead of applied twice.
    public func libraryCommand(_ encoded: String) throws -> String {
        guard encoded.utf8.count <= 65_536 else { throw HostError.validation("requestJson") }
        guard let request = (try? JSONSerialization.jsonObject(with: Data(encoded.utf8))) as? [String: Any],
              let action = request["action"] as? String else { throw HostError.validation("requestJson") }
        var state = try state()
        if action != "list" {
            guard let commandId = request["commandId"] as? String, UUID(uuidString: commandId) != nil else {
                throw HostError.validation("commandId")
            }
            state.libraryReceipts.removeAll { now.timeIntervalSince($0.at) >= 86_400 }
            if state.libraryReceipts.contains(where: { $0.id == commandId }) { return try librarySnapshot(state) }
            guard (request["revision"] as? NSNumber)?.intValue == state.libraryRevision else {
                throw HostError.validation("revision", retryable: true)
            }
            var undo: LibraryUndo?
            do {
                switch action {
                case "create", "rename", "pin", "reparent":
                    let old = action == "create" ? nil : state.folders.first { $0.id == request["id"] as? String }
                    if action != "create" && old == nil { throw FolderRules.Violation(message: "Folder no longer exists.") }
                    let parent = request["parentId"] as? String
                    let folder = FolderRecord(
                        id: old?.id ?? UUID().uuidString.lowercased(),
                        parentId: action == "reparent" ? parent : (old?.parentId ?? parent),
                        name: action == "pin" || action == "reparent" ? old!.name : try FolderRules.name(request["name"] as? String ?? ""),
                        pinned: action == "pin" ? (request["pinned"] as? Bool ?? false) : (old?.pinned ?? false)
                    )
                    try FolderRules.validate(state.folders.filter { $0.id != folder.id } + [folder])
                    if let index = state.folders.firstIndex(where: { $0.id == folder.id }) { state.folders[index] = folder } else { state.folders.append(folder) }
                case "delete":
                    guard let folder = state.folders.first(where: { $0.id == request["id"] as? String }) else {
                        throw FolderRules.Violation(message: "Folder no longer exists.")
                    }
                    let removed = Set([folder.id] + state.folders.filter { $0.parentId == folder.id }.map(\.id))
                    for (media, home) in state.memberships where removed.contains(home) {
                        // Sub-folder items return to their parent; main-folder items become Unsorted.
                        if home == folder.id, let parent = folder.parentId { state.memberships[media] = parent } else { state.memberships.removeValue(forKey: media) }
                    }
                    state.folders.removeAll { removed.contains($0.id) }
                case "move":
                    let items = request["items"] as? [[String: Any]] ?? []
                    guard (1...200).contains(items.count) else { throw FolderRules.Violation(message: "Select 1–200 items to move.") }
                    let ids = items.compactMap { $0["id"] as? String }
                    guard Set(ids).count == ids.count, ids.count == items.count else { throw FolderRules.Violation(message: "Duplicate selection.") }
                    for item in items {
                        guard let media = state.media.first(where: { $0.id == item["id"] as? String }),
                              media.entityVersion == (item["version"] as? NSNumber)?.intValue else {
                            throw FolderRules.Violation(message: "Selected media changed. Select it again.")
                        }
                    }
                    let destination = request["destination"] as? String
                    if let destination, !state.folders.contains(where: { $0.id == destination }) {
                        throw FolderRules.Violation(message: "Destination no longer exists.")
                    }
                    undo = LibraryUndo(at: now, rows: ids.map { id in
                        LibraryUndo.Row(id: id, folder: state.memberships[id], version: state.media.first { $0.id == id }!.entityVersion)
                    })
                    for id in ids { state.memberships[id] = destination }
                case "undo":
                    guard let saved = state.libraryUndo, (0...600).contains(now.timeIntervalSince(saved.at)) else {
                        throw FolderRules.Violation(message: "This move can no longer be undone.")
                    }
                    for row in saved.rows {
                        guard state.media.first(where: { $0.id == row.id })?.entityVersion == row.version else {
                            throw FolderRules.Violation(message: "Moved media changed; undo is unavailable.")
                        }
                        if let folder = row.folder, !state.folders.contains(where: { $0.id == folder }) {
                            throw FolderRules.Violation(message: "Original folder no longer exists.")
                        }
                    }
                    for row in saved.rows { state.memberships[row.id] = row.folder }
                default:
                    throw FolderRules.Violation(message: "Unknown library action.")
                }
            } catch is FolderRules.Violation {
                throw HostError.validation(action)
            }
            state.libraryReceipts = Array((state.libraryReceipts + [CommandReceipt(id: commandId, at: now)]).suffix(32))
            state.libraryRevision += 1
            state.libraryUndo = undo
            try commit(state)
        }
        return try librarySnapshot(state)
    }

    func librarySnapshot(_ state: KernelState) throws -> String {
        func covers(_ media: [MediaRecord]) -> [Any] {
            media.sorted { $0.createdAt > $1.createdAt }.prefix(4).map { ["kind": $0.kind.rawValue, "thumbnailToken": wireNull(thumbnailToken($0))] as WireMap }
        }
        let counts = Dictionary(grouping: state.memberships.values, by: { $0 }).mapValues(\.count)
        let folders: [Any] = state.folders.map { folder in
            let children = state.folders.filter { $0.parentId == folder.id }.map(\.id)
            let homes = Set([folder.id] + children)
            return [
                "id": folder.id, "parentId": wireNull(folder.parentId), "name": folder.name, "pinned": folder.pinned,
                "directCount": counts[folder.id] ?? 0,
                "count": homes.reduce(0) { $0 + (counts[$1] ?? 0) },
                "subfolderCount": children.count,
                "covers": covers(state.media.filter { state.memberships[$0.id].map(homes.contains) ?? false }),
            ] as WireMap
        }
        let canUndo = state.libraryUndo.map { (0...600).contains(now.timeIntervalSince($0.at)) } ?? false
        let snapshot: WireMap = [
            "revision": state.libraryRevision,
            "total": state.media.count,
            "unsorted": state.media.filter { state.memberships[$0.id] == nil }.count,
            "unsortedCovers": covers(state.media.filter { state.memberships[$0.id] == nil }),
            "canUndo": canUndo,
            "folders": folders,
        ]
        let data = try JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
        return String(decoding: data, as: UTF8.self)
    }
}
