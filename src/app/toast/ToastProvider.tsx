/**
 * App-wide toast queue.
 *
 * A screen never renders `Toast` (design-system) directly — it calls
 * `useToast().showToast(...)`, and this provider (mounted once at the app
 * root, see `App.tsx`) owns the single visible instance. One-at-a-time by
 * design: a queue, not a stack of simultaneous banners, because MR-13's
 * cognitive-accessibility stance elsewhere in this app (no competing
 * alerts) argues against ever showing two toasts at once.
 *
 * `current.id` keys the rendered `Toast` so two toasts queued back-to-back
 * each get a fresh mount — without the key, React would just patch the
 * existing element's text between two already-`visible` renders and the
 * slide-in/out `entering`/`exiting` animations would never re-fire for the
 * second toast.
 */
import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import type {PropsWithChildren} from 'react';

import type {HapticPattern} from '../../core/services';
import {Toast, type ToastTone} from '../../design-system';
// Direct file import, not the `../../hooks` barrel: several hooks behind
// that barrel (e.g. `useImportMedia`, `useSaveReminder`) call `useToast`
// themselves, and importing the barrel here would make this module part of
// that same import cycle.
import {useHaptics} from '../../hooks/useHaptics';

export interface ShowToastRequest {
  readonly message: string;
  readonly tone?: ToastTone;
  readonly durationMs?: number;
  /** Fired once, when this toast becomes the visible one — not repeated for its whole duration. */
  readonly haptic?: HapticPattern;
}

interface ToastEntry extends ShowToastRequest {
  readonly id: number;
}

export interface ToastContextValue {
  readonly showToast: (request: ShowToastRequest) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 3000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({children}: PropsWithChildren) {
  const haptics = useHaptics();
  const [queue, setQueue] = useState<readonly ToastEntry[]>([]);
  const nextId = useRef(0);
  const current = queue[0] ?? null;

  const showToast = useCallback((request: ShowToastRequest) => {
    const id = nextId.current;
    nextId.current += 1;
    setQueue(q => [...q, {...request, id}]);
  }, []);

  useEffect(() => {
    if (!current) {
      return;
    }
    if (current.haptic) {
      haptics.trigger(current.haptic);
    }
    const timeout = setTimeout(() => {
      setQueue(q => q.slice(1));
    }, current.durationMs ?? DEFAULT_DURATION_MS);
    return () => clearTimeout(timeout);
    // Only `current.id` should retrigger this — `haptics` is a stable
    // control object, and re-running on every queue mutation would replay
    // the haptic/timer for the same still-visible toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  return (
    <ToastContext.Provider value={{showToast}}>
      {children}
      {current ? <Toast key={current.id} message={current.message} tone={current.tone} /> : null}
    </ToastContext.Provider>
  );
}
