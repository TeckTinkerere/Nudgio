/**
 * Motion tokens (MR-04 "Motion", MR-13 ACC-006).
 *
 * Every entry declares its reduced-motion counterpart in the same place, so a
 * new animation cannot ship without someone deciding what it does when the
 * user has asked for less movement. MR-04 also forbids looping decorative
 * animation and flashing as an urgency signal — there is no `loop` token.
 */

/** Material 3 easing curves expressed as cubic-bezier control points. */
export const easing = {
  standard: [0.2, 0.0, 0.0, 1.0],
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1.0],
  emphasizedAccelerate: [0.3, 0.0, 0.8, 0.15],
  linear: [0.0, 0.0, 1.0, 1.0],
} as const;

export type EasingToken = keyof typeof easing;

export type ReducedMotionBehavior = 'instant' | 'fade' | 'nonVisual';

export interface MotionSpec {
  readonly durationMs: number;
  readonly easing: EasingToken;
  /** What happens when the reduced-motion preference is on. */
  readonly reduced: ReducedMotionBehavior;
  /** Duration to use in reduced mode when `reduced` is 'fade'. */
  readonly reducedDurationMs: number;
}

export const motion = {
  navigation: {
    durationMs: 250,
    easing: 'standard',
    reduced: 'fade',
    reducedDurationMs: 100,
  },
  cardExpand: {
    durationMs: 200,
    easing: 'emphasizedDecelerate',
    reduced: 'instant',
    reducedDurationMs: 0,
  },
  stripEnter: {
    durationMs: 220,
    easing: 'emphasizedDecelerate',
    reduced: 'fade',
    reducedDurationMs: 100,
  },
  snackbar: {
    durationMs: 200,
    easing: 'standard',
    reduced: 'fade',
    reducedDurationMs: 100,
  },
  /** MR-04: confirmation may fall back to haptic/color only. */
  alarmButtonConfirm: {
    durationMs: 120,
    easing: 'standard',
    reduced: 'nonVisual',
    reducedDurationMs: 0,
  },
} as const satisfies Record<string, MotionSpec>;

export type MotionToken = keyof typeof motion;

/** Effective duration for a token given the user's reduced-motion preference. */
export const resolveDuration = (token: MotionToken, reduceMotion: boolean): number => {
  const spec = motion[token];
  return reduceMotion ? spec.reducedDurationMs : spec.durationMs;
};
