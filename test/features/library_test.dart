import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/features/library/folder_destinations.dart';
import 'package:nudgio/features/library/library_albums.dart';
import 'package:nudgio/native/types.dart';

const snapshot = {
  'revision': 7,
  'total': 9,
  'unsorted': 2,
  'canUndo': true,
  'unsortedCovers': [
    {'kind': 'image', 'thumbnailToken': 'file:///t/u.webp'},
    {'kind': 'bogus'},
  ],
  'folders': [
    {
      'id': 'b', 'name': 'Workouts', 'parentId': null, 'pinned': false, 'count': 3, 'directCount': 3, //
      'subfolderCount': 0, 'covers': [{'kind': 'video', 'thumbnailToken': null}],
    },
    {
      'id': 'a', 'name': 'Family', 'parentId': null, 'pinned': true, 'count': 4, 'directCount': 1, //
      'subfolderCount': 1, 'covers': [{'kind': 'image', 'thumbnailToken': 'file:///t/a.webp'}],
    },
    {'id': 'c', 'name': 'Grandma', 'parentId': 'a', 'pinned': false, 'count': 3, 'directCount': 3},
    {'name': 'missing id'},
    'not an object',
  ],
};

void main() {
  group('decodeLibraryAlbums', () {
    test('decodes albums, covers and counts, dropping malformed entries', () {
      final decoded = decodeLibraryAlbums(snapshot)!;
      expect(decoded.revision, 7);
      expect(decoded.unsorted, 2);
      expect(decoded.canUndo, isTrue);
      expect(decoded.unsortedCovers, [const AlbumCover(kind: MediaKind.image, thumbnailToken: 'file:///t/u.webp')]);
      expect(decoded.albums.map((a) => a.id), ['b', 'a', 'c']);
      expect(decoded.albums[1].pinned, isTrue);
      expect(decoded.albums[1].subAlbumCount, 1);
      // Older native builds send no covers/subfolderCount: defaults, no crash.
      expect(decoded.albums[2].parentId, 'a');
      expect(decoded.albums[2].covers, isEmpty);
      expect(decoded.albums[2].subAlbumCount, 0);
    });

    test('rejects something that is not a snapshot', () {
      expect(decodeLibraryAlbums(null), isNull);
      expect(decodeLibraryAlbums({'folders': <Object>[]}), isNull);
      expect(decodeLibraryAlbums('nope'), isNull);
    });
  });

  group('album ordering', () {
    final albums = decodeLibraryAlbums(snapshot)!.albums;

    test('pinned first, then by name, top level only', () {
      expect(topLevelAlbums(albums).map((a) => a.name), ['Family', 'Workouts']);
    });

    test("lists an album's own sub-albums", () {
      expect(subAlbumsOf(albums, 'a').map((a) => a.name), ['Grandma']);
      expect(subAlbumsOf(albums, 'b'), isEmpty);
    });
  });

  group('folderDestinations', () {
    const folders = [
      DestinationFolder(id: 'a', name: 'Work'),
      DestinationFolder(id: 'b', name: 'Receipts', parentId: 'a'),
      DestinationFolder(id: 'c', name: 'Home'),
    ];

    test('search includes the parent path and ignores surrounding spaces', () {
      expect(folderDestinations(folders, {}, ' work ').map((d) => d.id), ['a', 'b']);
    });

    test('a folder with children can only move back to the root', () {
      expect(folderDestinations(folders, {'a'}, '').every((d) => d.disabled), isTrue);
    });

    test('a subfolder can move into another main folder but never itself or a subfolder', () {
      final destinations = folderDestinations(folders, {'b'}, '');
      expect(destinations.firstWhere((d) => d.id == 'c').disabled, isFalse);
      expect(destinations.firstWhere((d) => d.id == 'b').disabled, isTrue);
    });
  });
}
