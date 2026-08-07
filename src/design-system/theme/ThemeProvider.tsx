/**
 * Theme provider.
 *
 * Takes its inputs as props rather than reading a repository, keeping the
 * design system a leaf layer (see the ESLint boundary in `.eslintrc.js`). The
 * application wires it to persisted settings in `src/app/AppProviders.tsx`.
 */
import type {PropsWithChildren} from 'react';
import {useEffect, useMemo, useState} from 'react';
import {
  AccessibilityInfo,
  I18nManager,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import {widthClassFor} from '../tokens';
import {buildTheme} from './buildTheme';
import type {DynamicColorPayload} from './materialYou';
import type {ThemeAppearance} from './schemes';
import type {ThemePreference} from './Theme';
import {ThemeContext} from './ThemeContext';

export interface ThemeProviderProps {
  readonly preference: ThemePreference;
  /** User opt-in. MR-04 keeps the brand palette as the default. */
  readonly useMaterialYou: boolean;
  /** Null on API < 31 or when the platform reports no palette. */
  readonly dynamicColor: DynamicColorPayload | null;
  /** Test seam: force an appearance without touching the OS setting. */
  readonly forceAppearance?: ThemeAppearance;
}

const resolveAppearance = (
  preference: ThemePreference,
  systemScheme: ReturnType<typeof useColorScheme>,
): ThemeAppearance => {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  // MR-03 offers a system option; `null` from the OS means "unknown", and
  // light is the safer default for an app whose alarm surface is always dark.
  return systemScheme === 'dark' ? 'dark' : 'light';
};

export function ThemeProvider({
  preference,
  useMaterialYou,
  dynamicColor,
  forceAppearance,
  children,
}: PropsWithChildren<ThemeProviderProps>) {
  const systemScheme = useColorScheme();
  const {width, fontScale} = useWindowDimensions();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!cancelled) {
          setReduceMotion(enabled);
        }
      })
      // A failure to read the preference must not break rendering; assume
      // motion is allowed but keep the subscription below as the correction.
      .catch(() => undefined);

    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    // `highTextContrastChanged` is Android-only and absent on some versions.
    // Guarded so an unsupported platform degrades instead of throwing.
    let contrastSubscription: {remove(): void} | undefined;
    try {
      contrastSubscription = AccessibilityInfo.addEventListener(
        'highTextContrastChanged',
        setHighContrast,
      );
    } catch {
      contrastSubscription = undefined;
    }

    return () => {
      cancelled = true;
      motionSubscription.remove();
      contrastSubscription?.remove();
    };
  }, []);

  const theme = useMemo(
    () =>
      buildTheme({
        appearance: forceAppearance ?? resolveAppearance(preference, systemScheme),
        dynamicColor,
        useMaterialYou,
        reduceMotion,
        highContrast,
        fontScale,
        widthClass: widthClassFor(width),
        isRtl: I18nManager.isRTL,
      }),
    [
      forceAppearance,
      preference,
      systemScheme,
      dynamicColor,
      useMaterialYou,
      reduceMotion,
      highContrast,
      fontScale,
      width,
    ],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
