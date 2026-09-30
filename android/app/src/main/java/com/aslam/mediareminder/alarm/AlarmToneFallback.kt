package com.aslam.mediareminder.alarm

/** Bounded sequential fallback. Callbacks and commands run on the owning thread. */
class AlarmToneFallback<T>(
    private val sources: List<T>,
    private val create: () -> Player<T>,
) {
    interface Player<T> {
        fun prepare(source: T, ready: () -> Unit, failed: () -> Unit)
        fun start()
        fun release()
    }

    private var current: Player<T>? = null
    private var next = 0
    private var stopped = false

    fun start() {
        if (stopped || current != null) return
        advance()
    }

    private fun advance() {
        if (stopped || next >= sources.size) return
        val source = sources[next++]
        val player = try { create() } catch (_: Exception) { advance(); return }
        current = player
        val failed = {
            if (current === player) {
                current = null
                runCatching { player.release() }
                advance()
            }
        }
        try {
            player.prepare(source, ready = {
                if (!stopped && current === player) {
                    try { player.start() } catch (_: Exception) { failed() }
                }
            }, failed = failed)
        } catch (_: Exception) {
            failed()
        }
    }

    fun stop() {
        stopped = true
        val player = current
        current = null
        runCatching { player?.release() }
    }
}
