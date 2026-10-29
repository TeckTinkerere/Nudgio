import '../../native/types.dart';
import '../reminders/reminder_status.dart' show compareLabels;

/// The Library's album model: the native folder snapshot (`libraryCommand`),
/// decoded once at the boundary (MR-18). Storage calls these folders; the UI
/// calls them albums, as people know them from their phone's gallery.
/// Ported from `libraryAlbums.ts`.
final class AlbumCover {
  const AlbumCover({required this.kind, required this.thumbnailToken});
  final MediaKind kind;
  final String? thumbnailToken;

  @override
  bool operator ==(Object other) => other is AlbumCover && other.kind == kind && other.thumbnailToken == thumbnailToken;

  @override
  int get hashCode => Object.hash(kind, thumbnailToken);
}

final class Album {
  const Album({
    required this.id,
    required this.name,
    required this.parentId,
    required this.pinned,
    required this.count,
    required this.directCount,
    required this.subAlbumCount,
    required this.covers,
  });

  final String id;
  final String name;
  final String? parentId;
  final bool pinned;

  /// Items in this album and its sub-albums.
  final int count;

  /// Items filed directly in this album.
  final int directCount;
  final int subAlbumCount;

  /// Newest first, at most four: the cover mosaic.
  final List<AlbumCover> covers;
}

final class LibraryAlbums {
  const LibraryAlbums({
    required this.albums,
    required this.revision,
    required this.total,
    required this.unsorted,
    required this.unsortedCovers,
    required this.canUndo,
  });

  static const empty =
      LibraryAlbums(albums: [], revision: 0, total: 0, unsorted: 0, unsortedCovers: [], canUndo: false);

  final List<Album> albums;
  final int revision;
  final int total;
  final int unsorted;
  final List<AlbumCover> unsortedCovers;
  final bool canUndo;
}

int _num(Object? value) => switch (value) {
      final int n => n,
      final double d when d.isFinite => d.toInt(),
      _ => 0,
    };

MediaKind? _kind(Object? value) {
  for (final kind in MediaKind.values) {
    if (kind.name == value) return kind;
  }
  return null;
}

List<AlbumCover> _covers(Object? value) => [
      if (value is List)
        for (final cover in value)
          if (cover is Map && _kind(cover['kind']) != null)
            AlbumCover(
              kind: _kind(cover['kind'])!,
              thumbnailToken: cover['thumbnailToken'] is String ? cover['thumbnailToken'] as String : null,
            ),
    ];

/// Null when [value] is not a library snapshot; malformed albums are dropped.
LibraryAlbums? decodeLibraryAlbums(Object? value) {
  if (value is! Map || value['revision'] is! num) return null;
  final folders = value['folders'];
  return LibraryAlbums(
    albums: [
      if (folders is List)
        for (final folder in folders)
          if (folder is Map && folder['id'] is String && folder['name'] is String)
            Album(
              id: folder['id'] as String,
              name: folder['name'] as String,
              parentId: folder['parentId'] is String ? folder['parentId'] as String : null,
              pinned: folder['pinned'] == true,
              count: _num(folder['count']),
              directCount: _num(folder['directCount']),
              subAlbumCount: _num(folder['subfolderCount']),
              covers: _covers(folder['covers']),
            ),
    ],
    revision: _num(value['revision']),
    total: _num(value['total']),
    unsorted: _num(value['unsorted']),
    unsortedCovers: _covers(value['unsortedCovers']),
    canUndo: value['canUndo'] == true,
  );
}

/// Pinned first, then by name: the order people scan a shelf of albums.
List<Album> sortAlbums(Iterable<Album> albums) => [...albums]..sort((a, b) {
    if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
    return compareLabels(a.name, b.name);
  });

List<Album> topLevelAlbums(Iterable<Album> albums) => sortAlbums(albums.where((album) => album.parentId == null));

List<Album> subAlbumsOf(Iterable<Album> albums, String parentId) =>
    sortAlbums(albums.where((album) => album.parentId == parentId));
