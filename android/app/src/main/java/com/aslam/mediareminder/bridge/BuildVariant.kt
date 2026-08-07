package com.aslam.mediareminder.bridge

import com.aslam.mediareminder.BuildConfig

/**
 * MR-07 "Build variants": debug / qa / release. Read once from
 * `BuildConfig.BUILD_VARIANT` (stamped per build type in `app/build.gradle`)
 * rather than inferred from `BuildConfig.DEBUG`, since `qa` is release-signed
 * and optimized but still not `release` for diagnostics purposes.
 *
 * Reported to JS in `StartupSnapshot.buildVariant` so
 * `core/config/featureFlags.ts` derives its flags from the real build instead
 * of only `__DEV__`.
 */
object BuildVariant {
    val current: String = BuildConfig.BUILD_VARIANT
}
