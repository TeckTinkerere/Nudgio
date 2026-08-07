package com.aslam.mediareminder

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.aslam.mediareminder.bridge.MediaReminderPackage

/**
 * Application entry point.
 *
 * MR-07 "app-shell": this is where the RN host is constructed. Nothing
 * beyond package registration and the standard New Architecture bootstrap
 * belongs here — startup reconciliation, theme resolution and the error
 * boundary all live on the JS side (`src/app`).
 */
class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Autolinking (MR-18 dependency policy) covers every
                    // third-party RN package. The app's own native surface is
                    // added explicitly here.
                    add(MediaReminderPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        // MUST pass OpenSourceMergedSoMapping, not the pre-0.76 `false` flag.
        //
        // React Native 0.76+ merges every core native library
        // (`react_featureflagsjni`, `reactnativejni`, `turbomodulejsijni`,
        // `fabricjni`, `yoga`, ...) into a single `libreactnative.so`. The
        // individual `.so` files no longer exist in the APK.
        // `OpenSourceMergedSoMapping.mapLibName()` is what rewrites a request
        // for one of those old names to `reactnative`.
        //
        // `SoLoader.init(this, false)` installs no mapping, so NativeLoader
        // falls back to `SystemDelegate`, which calls `System.loadLibrary()`
        // verbatim. The first thing the New Architecture entry point below
        // touches is ReactNativeFeatureFlags, so startup died in
        // Application.onCreate with:
        //   UnsatisfiedLinkError: dlopen failed:
        //   library "libreact_featureflagsjni.so" not found
        // i.e. an immediate launch crash, before any JS or Activity ran.
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native
            // entry point for this app.
            load()
        }
    }
}
