/**
 * Build-invariant application configuration.
 *
 * Values that differ per build variant (MR-07: `debug`, `qa`, `release`) live
 * in `featureFlags.ts` and are keyed off `__DEV__` plus a native-reported
 * variant, never off a hardcoded environment string in JS.
 */

export const appConfig = {
  /** Must match `app.json` and the Kotlin `MainActivity.getMainComponentName`. */
  registeredAppName: 'MediaReminder',
  packageId: 'com.aslam.mediareminder',

  /**
   * MR-08: "Bridge contract version is integer and changes only for breaking
   * semantics." The native module reports its own; a mismatch is a hard
   * developer error in debug and an update-required screen in release.
   */
  bridgeContractVersion: 1,

  /**
   * ADR-014: v1 archives are plaintext ZIP. Semantic `major.minor`.
   * Kept here so the export UI and the About screen cannot disagree.
   */
  backupArchiveVersion: '1.0',

  /** MR-09 retention defaults, surfaced in Settings. */
  retention: {
    occurrenceHistoryDays: 90,
    alarmActionIdempotencyDays: 7,
    uiMutationIdempotencyHours: 24,
    backupCommitIdempotencyDays: 30,
    completedExportHours: 24,
  },

  /**
   * MR-09 storage limits. Product protections, not filesystem capabilities —
   * the UI shows estimates before any copy begins.
   */
  storage: {
    assetSoftWarningBytes: 500 * 1024 * 1024,
    assetHardLimitBytes: 2 * 1024 * 1024 * 1024,
    backupUncompressedHardLimitBytes: 10 * 1024 * 1024 * 1024,
    freeSpaceReserveBytes: 250 * 1024 * 1024,
    freeSpaceReserveFraction: 0.05,
    thumbnailCacheBytes: 250 * 1024 * 1024,
    diagnosticsRingBufferBytes: 5 * 1024 * 1024,
  },

  /** MR-09 field length limits, enforced in the editor before save. */
  limits: {
    titleMaxLength: 160,
    notesMaxLength: 4000,
    categoryNameMaxLength: 60,
    tagNameMaxLength: 60,
  },

  /** MR-03 snooze policy. Custom input is 1 minute to 24 hours in MVP. */
  snooze: {
    presetMinutes: [5, 10, 15, 30, 60] as const,
    minimumMinutes: 1,
    maximumMinutes: 24 * 60,
  },

  /** ADR-019 platform baseline. Mirrored in `android/app/build.gradle`. */
  platform: {
    minSdk: 26,
    compileSdk: 37,
    targetSdk: 36,
    /** Material You (dynamic color) is available from API 31. */
    dynamicColorMinSdk: 31,
  },
} as const;

export type AppConfig = typeof appConfig;
