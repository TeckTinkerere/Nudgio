/**
 * Build-variant behavior (MR-07 "Build variants").
 *
 * Flags are read from a single frozen object created at startup, not from
 * scattered `__DEV__` checks, so a release build's behavior is auditable in
 * one place. MR-07 requires that debug-only surfaces are *absent* from release
 * — a flag that merely hides a screen is not sufficient for the native
 * injection APIs, which are excluded from the release Codegen spec instead.
 */

export type BuildVariant = 'debug' | 'qa' | 'release';

export interface FeatureFlags {
  readonly variant: BuildVariant;
  /** Developer menu and synthetic event injector. Debug only. */
  readonly developerTools: boolean;
  /** Verbose local logging. Never enabled in release. */
  readonly verboseLogging: boolean;
  /**
   * Surfaces a bridge contract mismatch as a thrown developer error rather
   * than the user-facing update-required screen (MR-08).
   */
  readonly strictContractVersion: boolean;
  /**
   * Material You. Off by default at the product level (MR-04 keeps the brand
   * palette as the default); this flag controls whether the *setting* is
   * offered at all, so it can be withheld from a release until reviewed.
   */
  readonly materialYouSettingVisible: boolean;
  /** MR-09: text assets are a P1 item; the Add sheet hides the entry when off. */
  readonly textAssetsEnabled: boolean;
  /** MR-03: duplicate-hash prompt on import is a P1 behavior. */
  readonly duplicateDetectionEnabled: boolean;
}

const FLAGS_BY_VARIANT: Readonly<Record<BuildVariant, FeatureFlags>> = {
  debug: {
    variant: 'debug',
    developerTools: true,
    verboseLogging: true,
    strictContractVersion: true,
    materialYouSettingVisible: true,
    textAssetsEnabled: true,
    duplicateDetectionEnabled: true,
  },
  qa: {
    variant: 'qa',
    developerTools: false,
    // MR-07: qa uses "controlled diagnostics", not verbose logging.
    verboseLogging: false,
    strictContractVersion: true,
    materialYouSettingVisible: true,
    textAssetsEnabled: true,
    duplicateDetectionEnabled: true,
  },
  release: {
    variant: 'release',
    developerTools: false,
    verboseLogging: false,
    strictContractVersion: false,
    materialYouSettingVisible: true,
    textAssetsEnabled: false,
    duplicateDetectionEnabled: false,
  },
};

export const featureFlagsFor = (variant: BuildVariant): FeatureFlags =>
  Object.freeze({...FLAGS_BY_VARIANT[variant]});

/**
 * Resolve the variant. The native module reports it authoritatively; `__DEV__`
 * is only the fallback for a JS-only test environment where no bridge exists.
 */
export const resolveBuildVariant = (reported: string | undefined): BuildVariant => {
  if (reported === 'debug' || reported === 'qa' || reported === 'release') {
    return reported;
  }
  return __DEV__ ? 'debug' : 'release';
};
