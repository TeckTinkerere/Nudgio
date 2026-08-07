import type {MotionToken} from '../design-system';
import {useTheme,resolveDuration} from '../design-system';

/**
 * Thin convenience over the theme's motion tokens (MR-13 ACC-006). Kept in
 * `hooks` rather than `design-system` because it is a policy decision
 * ("how do features consume motion tokens"), not a presentational primitive.
 */
export const useMotionDuration = (token: MotionToken): number => {
  const theme = useTheme();
  return resolveDuration(token, theme.a11y.reduceMotion);
};
