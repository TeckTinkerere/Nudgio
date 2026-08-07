package com.aslam.mediareminder.bridge

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers [MediaReminderModule] with the TurboModule registry.
 *
 * `TurboReactPackage` (rather than the legacy `ReactPackage`) is what makes
 * the module resolvable via `TurboModuleRegistry.get()` on the JS side
 * (`native-client/NativeMediaReminder.ts`) without a generated Codegen
 * package — see the class doc on `MediaReminderModule` for why Codegen
 * itself was not run in this environment.
 */
class MediaReminderPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == MediaReminderModule.NAME) MediaReminderModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            MediaReminderModule.NAME to ReactModuleInfo(
                MediaReminderModule.NAME,
                MediaReminderModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule — this is a JVM/Kotlin module, not JSI/C++
                true, // isTurboModule
            ),
        )
    }
}
