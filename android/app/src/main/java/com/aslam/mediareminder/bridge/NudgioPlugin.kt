package com.aslam.mediareminder.bridge

import android.app.Activity
import android.content.Intent
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry
import java.util.concurrent.ConcurrentHashMap

/**
 * Connects one Flutter engine to the Kotlin core: the `nudgio/host` method
 * channel ([NudgioHostChannel]), the `nudgio/events` event channel
 * ([HostEvents]), and activity results and permission prompts for
 * [MediaReminderModule]. Registered by [com.aslam.mediareminder.MainActivity].
 *
 * Nothing about alarms passes through here. Receivers, the ringing service and
 * `AlarmActivity` run with no engine at all (AND-002); this plugin only serves
 * the UI while one is attached.
 */
class NudgioPlugin :
    FlutterPlugin,
    ActivityAware,
    ActivityHost,
    PluginRegistry.ActivityResultListener,
    PluginRegistry.RequestPermissionsResultListener {

    private var module: MediaReminderModule? = null
    private var methodChannel: MethodChannel? = null
    private var eventChannel: EventChannel? = null
    private var binding: ActivityPluginBinding? = null
    private val pendingPermissions = ConcurrentHashMap<Int, (IntArray) -> Unit>()

    override val currentActivity: Activity?
        get() = binding?.activity

    override fun onAttachedToEngine(engine: FlutterPlugin.FlutterPluginBinding) {
        val hostModule = MediaReminderModule(engine.applicationContext, this)
        module = hostModule
        methodChannel = MethodChannel(engine.binaryMessenger, HOST_CHANNEL).apply {
            setMethodCallHandler(NudgioHostChannel(hostModule))
        }
        eventChannel = EventChannel(engine.binaryMessenger, EVENT_CHANNEL).apply {
            setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
                    HostEvents.sink = HostEvents.Sink { events.success(it) }
                }

                override fun onCancel(arguments: Any?) {
                    HostEvents.sink = null
                }
            })
        }
    }

    override fun onDetachedFromEngine(engine: FlutterPlugin.FlutterPluginBinding) {
        HostEvents.sink = null
        methodChannel?.setMethodCallHandler(null)
        eventChannel?.setStreamHandler(null)
        module?.dispose()
        module = null
    }

    override fun onAttachedToActivity(activityBinding: ActivityPluginBinding) {
        binding = activityBinding
        activityBinding.addActivityResultListener(this)
        activityBinding.addRequestPermissionsResultListener(this)
    }

    override fun onDetachedFromActivity() {
        binding?.removeActivityResultListener(this)
        binding?.removeRequestPermissionsResultListener(this)
        binding = null
        HostEvents.hasForegroundActivity = false
        // A prompt left open across teardown can never answer; report it denied
        // rather than leave the Dart future hanging.
        pendingPermissions.keys.toList().forEach { code -> pendingPermissions.remove(code)?.invoke(IntArray(0)) }
    }

    override fun onDetachedFromActivityForConfigChanges() = onDetachedFromActivity()

    override fun onReattachedToActivityForConfigChanges(activityBinding: ActivityPluginBinding) =
        onAttachedToActivity(activityBinding)

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean =
        module?.onActivityResult(requestCode, resultCode, data) ?: false

    override fun requestPermissions(permissions: Array<String>, requestCode: Int, onResult: (IntArray) -> Unit) {
        val activity = currentActivity ?: return onResult(IntArray(0))
        pendingPermissions[requestCode] = onResult
        activity.requestPermissions(permissions, requestCode)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Boolean {
        val callback = pendingPermissions.remove(requestCode) ?: return false
        callback(grantResults)
        return true
    }

    companion object {
        /** Must match `hostChannelName`/`eventChannelName` in `lib/native/host_contract.dart`. */
        const val HOST_CHANNEL = "nudgio/host"
        const val EVENT_CHANNEL = "nudgio/events"
    }
}
