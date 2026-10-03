/**
 * Library albums: the decoded native snapshot plus the commands that change
 * it. Every command carries the revision the user last saw and a fresh
 * command id; native rejects a stale revision and replays a duplicate id,
 * so a double tap or a concurrent change can never apply twice or silently.
 *
 * The revision lives in a ref as well as state so that several commands run
 * back to back (moving three albums, then the media) each send the revision
 * the previous one produced, not the one captured when the handler started.
 */
import {useCallback, useRef, useState} from 'react';

import {decodeLibraryAlbums, EMPTY_LIBRARY, newCommandId, type LibraryAlbums} from './libraryAlbums';
import {useAppContainer} from '../../app/di';

export type AlbumCommand =
  | {readonly action: 'create'; readonly name: string; readonly parentId: string | null}
  | {readonly action: 'rename'; readonly id: string; readonly name: string}
  | {readonly action: 'pin'; readonly id: string; readonly pinned: boolean}
  | {readonly action: 'reparent'; readonly id: string; readonly parentId: string | null}
  | {
      readonly action: 'move';
      readonly destination: string | null;
      readonly items: readonly {readonly id: string; readonly version: number}[];
    }
  | {readonly action: 'delete'; readonly id: string}
  | {readonly action: 'undo'};

export type LibraryLoadStatus = 'loading' | 'ready' | 'failed';

export function useLibraryAlbums() {
  const {client} = useAppContainer();
  const [library, setLibrary] = useState<LibraryAlbums>(EMPTY_LIBRARY);
  const [status, setStatus] = useState<LibraryLoadStatus>('loading');
  const revision = useRef(0);

  const apply = useCallback((value: unknown): LibraryAlbums | null => {
    const decoded = decodeLibraryAlbums(value);
    if (decoded) {
      revision.current = decoded.revision;
      setLibrary(decoded);
    }
    return decoded;
  }, []);

  const refresh = useCallback(async (): Promise<LibraryAlbums | null> => {
    const result = await client.libraryCommand({action: 'list'});
    const decoded = result.ok ? apply(result.value) : null;
    setStatus(current => (decoded ? 'ready' : current === 'ready' ? 'ready' : 'failed'));
    return decoded;
  }, [apply, client]);

  /** Resolves the new snapshot, or `null` when native refused (stale revision, rule violation, gone). */
  const run = useCallback(
    async (command: AlbumCommand): Promise<LibraryAlbums | null> => {
      const result = await client.libraryCommand({...command, revision: revision.current, commandId: newCommandId()});
      return result.ok ? apply(result.value) : null;
    },
    [apply, client],
  );

  return {library, status, refresh, run};
}
