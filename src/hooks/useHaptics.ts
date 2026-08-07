/**
 * Feature-facing haptics: combines `HapticsService` with the MR-13
 * "stronger haptics toggle where supported" preference.
 *
 * Kept in `hooks` rather than `design-system` for the same reason as
 * `useMotionDuration` — this is a policy decision (which actions get a
 * confirmation buzz, and at what intensity), not a presentational primitive,
 * and `design-system` components are not allowed to reach into services
 * (see the boundary rule noted in `design-system/index.ts`).
 */
import {useCallback} from 'react';

import {useViewState} from './useViewState';
import {useAppContainer} from '../app/di';
import type {HapticPattern} from '../core/services';
import {viewStateKeys} from '../core/storage';

export interface HapticsControl {
  readonly stronger: boolean;
  readonly setStronger: (next: boolean) => void;
  readonly trigger: (pattern: HapticPattern) => void;
}

export const useHaptics = (): HapticsControl => {
  const {haptics} = useAppContainer();
  const [stronger, setStronger] = useViewState<boolean>(viewStateKeys.strongerHaptics, false);

  const trigger = useCallback(
    (pattern: HapticPattern) => haptics.vibrate(pattern, stronger),
    [haptics, stronger],
  );

  return {stronger, setStronger, trigger};
};
