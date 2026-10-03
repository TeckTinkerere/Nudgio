import {decodeLibraryAlbums, newCommandId, subAlbumsOf, topLevelAlbums} from '../libraryAlbums';

const snapshot = {
  revision: 7,
  total: 9,
  unsorted: 2,
  canUndo: true,
  unsortedCovers: [{kind: 'image', thumbnailToken: 'file:///t/u.webp'}, {kind: 'bogus'}],
  folders: [
    {id: 'b', name: 'Workouts', parentId: null, pinned: false, count: 3, directCount: 3, subfolderCount: 0,
      covers: [{kind: 'video', thumbnailToken: null}]},
    {id: 'a', name: 'Family', parentId: null, pinned: true, count: 4, directCount: 1, subfolderCount: 1,
      covers: [{kind: 'image', thumbnailToken: 'file:///t/a.webp'}]},
    {id: 'c', name: 'Grandma', parentId: 'a', pinned: false, count: 3, directCount: 3},
    {name: 'missing id'},
    'not an object',
  ],
};

describe('decodeLibraryAlbums', () => {
  it('decodes albums, covers and counts, dropping malformed entries', () => {
    const decoded = decodeLibraryAlbums(snapshot);
    expect(decoded).not.toBeNull();
    expect(decoded?.revision).toBe(7);
    expect(decoded?.unsorted).toBe(2);
    expect(decoded?.canUndo).toBe(true);
    expect(decoded?.unsortedCovers).toEqual([{kind: 'image', thumbnailToken: 'file:///t/u.webp'}]);
    expect(decoded?.albums.map(album => album.id)).toEqual(['b', 'a', 'c']);
    expect(decoded?.albums[1]).toMatchObject({name: 'Family', pinned: true, count: 4, subAlbumCount: 1});
    // Older native builds send no covers/subfolderCount — they default, never crash.
    expect(decoded?.albums[2]).toMatchObject({parentId: 'a', covers: [], subAlbumCount: 0});
  });

  it('rejects something that is not a snapshot', () => {
    expect(decodeLibraryAlbums(null)).toBeNull();
    expect(decodeLibraryAlbums({folders: []})).toBeNull();
    expect(decodeLibraryAlbums('nope')).toBeNull();
  });
});

describe('album ordering', () => {
  const albums = decodeLibraryAlbums(snapshot)!.albums;

  it('puts pinned albums first, then sorts by name, top level only', () => {
    expect(topLevelAlbums(albums).map(album => album.name)).toEqual(['Family', 'Workouts']);
  });

  it('lists an album\'s own sub-albums', () => {
    expect(subAlbumsOf(albums, 'a').map(album => album.name)).toEqual(['Grandma']);
    expect(subAlbumsOf(albums, 'b')).toEqual([]);
  });
});

describe('newCommandId', () => {
  it('is a fresh RFC 4122 version-4 UUID every time', () => {
    const ids = new Set(Array.from({length: 50}, () => newCommandId()));
    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
