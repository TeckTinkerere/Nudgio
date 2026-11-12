import '../reminders/reminder_status.dart' show compareLabels;

final class DestinationFolder {
  const DestinationFolder({required this.id, required this.name, this.parentId});
  final String id;
  final String name;
  final String? parentId;
}

final class FolderDestination {
  const FolderDestination({required this.folder, required this.path, required this.disabled});
  final DestinationFolder folder;

  /// `Parent › Child` for a sub-folder, the name alone otherwise.
  final String path;
  final bool disabled;

  String get id => folder.id;
}

/// Where a "Move to" can send [selected] folders. One level of nesting only,
/// so a main folder with children cannot be nested, and nothing moves into
/// itself or a sub-folder. Ported from `folderDestinations.ts`.
List<FolderDestination> folderDestinations(
  List<DestinationFolder> folders,
  Set<String> selected,
  String search,
) {
  final needle = search.trim().toLowerCase();
  final destinations = [
    for (final folder in folders)
      () {
        final parent = folders.where((item) => item.id == folder.parentId).firstOrNull;
        final path = parent == null ? folder.name : '${parent.name} › ${folder.name}';
        final disabled = selected.contains(folder.id) ||
            (folder.parentId != null && selected.contains(folder.parentId)) ||
            (selected.isNotEmpty && folder.parentId != null) ||
            selected.any((id) => folders.any((item) => item.parentId == id));
        return FolderDestination(folder: folder, path: path, disabled: disabled);
      }(),
  ].where((destination) => destination.path.toLowerCase().contains(needle)).toList()
    ..sort((a, b) => compareLabels(a.path, b.path));
  return destinations;
}
