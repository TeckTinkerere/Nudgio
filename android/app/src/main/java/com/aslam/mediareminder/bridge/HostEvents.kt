package com.aslam.mediareminder.bridge

import android.os.Handler
import android.os.Looper
import com.aslam.mediareminder.bridge.wire.WireMap
import com.aslam.mediareminder.bridge.wire.toPlatform

/**
 * The native → Dart event path (`nudgio/events`), replacing React Native's
 * `DeviceEventEmitter`.
 *
 * [sink] is set while a Flutter engine is listening ([NudgioPlugin]) and null
 * otherwise. Emitting with no listener is a silent no-op, the same rule the
 * React Native emitters followed: the posted notification and the
 * journal-backed operation are always the source of truth, never this stream.
 * Alarms fire, ring and resolve with no engine at all (AND-002).
 */
object HostEvents {
    /** Receives one `{event, payload}` map; called on the main thread. */
    fun interface Sink {
        fun send(event: Map<String, Any?>)
    }

    @Volatile
    var sink: Sink? = null

    /**
     * True while the Flutter activity is attached and resumed: MR-06 rule 4
     * only shows the in-app due card to someone looking at the app.
     */
    @Volatile
    var hasForegroundActivity: Boolean = false

    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    fun emit(event: String, payload: WireMap) {
        if (sink == null) return
        val message = mapOf("event" to event, "payload" to toPlatform(payload))
        // EventSink must be called on the platform thread; emitters run on IO
        // dispatchers and broadcast receivers.
        mainHandler.post { sink?.send(message) }
    }
}
