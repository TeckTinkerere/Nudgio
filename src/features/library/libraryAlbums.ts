/**
 * The Library's album model: the native folder snapshot (`libraryCommand`),
 * decoded once at the boundary (MR-18) so every screen works with typed
 * albums instead of re-casting the raw JSON in each handler.
 *
 * Storage still calls these folders (`library_folders`, one home per item,
 * one level of nesting); the UI calls them albums, because that is what
 * people already know from their phone's gallery.
 */
import type {MediaKind, ThumbnailToken, UUID} from '../../native-client/types';

export interface AlbumCover {
  readonly kind: MediaKind;
  readonly thumbnailToken: ThumbnailToken | null;
}

export interface Album {
  readonly id: UUID;
  readonly name: string;
  readonly parentId: UUID | null;
  readonly pinned: boolean;
  /** Items in this album and its sub-albums. */
  readonly count: number;
  /** Items filed directly in this album. */
  readonly directCount: number;
  readonly subAlbumCount: number;
  /** Newest first, at most four — the cover mosaic. */
  readonly covers: readonly AlbumCover[];
}

export interface LibraryAlbums {
  readonly albums: readonly Album[];
  readonly revision: number;
  readonly total: number;
  readonly unsorted: number;
  readonly unsortedCovers: readonly AlbumCover[];
  readonly canUndo: boolean;
}

export const EMPTY_LIBRARY: LibraryAlbums = {
  albums: [],
  revision: 0,
  total: 0,
  unsorted: 0,
  unsortedCovers: [],
  canUndo: false,
};

const MEDIA_KINDS: ReadonlySet<string> = new Set(['video', 'audio', 'image', 'text']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const decodeCovers = (value: unknown): AlbumCover[] =>
  Array.isArray(value)
    ? value.filter(isRecord).flatMap(cover =>
        typeof cover.kind === 'string' && MEDIA_KINDS.has(cover.kind)
          ? [{
              kind: cover.kind as MediaKind,
              thumbnailToken: typeof cover.thumbnailToken === 'string' ? (cover.thumbnailToken as ThumbnailToken) : null,
            }]
          : [],
      )
    : [];

/** `null` when the payload is not a library snapshot at all; malformed albums are dropped, not trusted. */
export const decodeLibraryAlbums = (value: unknown): LibraryAlbums | null => {
  if (!isRecord(value) || typeof value.revision !== 'number') {
    return null;
  }
  const albums: Album[] = Array.isArray(value.folders)
    ? value.folders.filter(isRecord).flatMap(folder =>
        typeof folder.id === 'string' && typeof folder.name === 'string'
          ? [{
              id: folder.id as UUID,
              name: folder.name,
              parentId: typeof folder.parentId === 'string' ? (folder.parentId as UUID) : null,
              pinned: folder.pinned === true,
              count: num(folder.count),
              directCount: num(folder.directCount),
              subAlbumCount: num(folder.subfolderCount),
              covers: decodeCovers(folder.covers),
            }]
          : [],
      )
    : [];
  return {
    albums,
    revision: value.revision,
    total: num(value.total),
    unsorted: num(value.unsorted),
    unsortedCovers: decodeCovers(value.unsortedCovers),
    canUndo: value.canUndo === true,
  };
};

/** Pinned first, then by name — the order people scan a shelf of albums. */
export const sortAlbums = (albums: readonly Album[]): Album[] =>
  [...albums].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

export const topLevelAlbums = (albums: readonly Album[]): Album[] => sortAlbums(albums.filter(album => album.parentId === null));

export const subAlbumsOf = (albums: readonly Album[], parentId: string): Album[] =>
  sortAlbums(albums.filter(album => album.parentId === parentId));

/**
 * A real random v4 UUID for each library command (native rejects anything
 * `UUID.fromString` cannot parse and de-duplicates retries by it). This
 * replaces six inline copies of a fixed-prefix pseudo-id.
 */
export const newCommandId = (): string => {
  const hex = (length: number) => Array.from({length}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
};
