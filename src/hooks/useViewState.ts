/**
 * Persist-for-the-session UI state (filters, sort order, collapsed sections)
 * through the `KeyValueStore` in the DI container.
 *
 * Deliberately NOT backed by React Query: this is client-only state with no
 * server counterpart to reconcile against, so the query cache's staleness
 * model does not apply. It is also explicitly disposable (MR-07) — losing a
 * scroll position or a filter selection on process death is acceptable, and
 * this hook makes no promise otherwise.
 */
import {useCallback, useEffect, useState} from 'react';

import {useAppContainer} from '../app/di';

export const useViewState = <T>(
  key: string,
  initialValue: T,
): readonly [T, (next: T) => void] => {
  const {viewState} = useAppContainer();
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    let cancelled = false;
    // `void` marks this as an intentional fire-and-forget read: the effect
    // itself cannot be async, and the `cancelled` guard below is the actual
    // cleanup, not this expression's return value.
    // eslint-disable-next-line no-void
    void viewState.get<T>(key).then(result => {
      if (!cancelled && result.ok && result.value !== null) {
        setValue(result.value);
      }
    });
    return () => {
      cancelled = true;
    };
    // Reload only if the key identity changes; `initialValue` is a seed, not
    // a dependency — re-running on every render would fight the store.
  }, [key, viewState]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      // Fire-and-forget write: `update()` is synchronous from the caller's
      // perspective (state updates immediately); persistence failure is
      // logged inside the store, not surfaced here (MR-07: view state is
      // disposable).
      // eslint-disable-next-line no-void
      void viewState.set(key, next);
    },
    [key, viewState],
  );

  return [value, update] as const;
};
