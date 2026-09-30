package com.aslam.mediareminder.alarm

import org.junit.Assert.*
import org.junit.Test

class AlarmToneFallbackTest {
    private class FakePlayer : AlarmToneFallback.Player<String> {
        lateinit var ready: () -> Unit
        lateinit var failed: () -> Unit
        var starts = 0
        var releases = 0
        var source = ""
        override fun prepare(source: String, ready: () -> Unit, failed: () -> Unit) {
            this.source = source
            this.ready = ready
            this.failed = failed
            if (source == "unreadable") throw IllegalStateException("unreadable")
        }
        override fun start() { starts++ }
        override fun release() { releases++ }
    }

    @Test fun missingCustomToneFallsBackAndStartsOnlyWhenPrepared() {
        val players = mutableListOf<FakePlayer>()
        val playback = AlarmToneFallback(listOf("unreadable", "packaged"), {
            FakePlayer().also { players.add(it) }
        })
        playback.start()
        assertEquals(2, players.size)
        assertEquals(1, players[0].releases)
        assertEquals(0, players[1].starts)
        players[1].ready()
        assertEquals(1, players[1].starts)
    }

    @Test fun asynchronousFailureAdvancesOnceAndIgnoresStaleCallbacks() {
        val players = mutableListOf<FakePlayer>()
        val playback = AlarmToneFallback(listOf("custom", "system", "packaged"), {
            FakePlayer().also { players.add(it) }
        })
        playback.start()
        players[0].failed()
        players[0].failed()
        players[0].ready()
        assertEquals(2, players.size)
        assertEquals(0, players[0].starts)
        assertEquals(1, players[0].releases)
        players[1].failed()
        assertEquals("packaged", players[2].source)
    }

    @Test fun stopPreventsLateCallbacksFromRestartingSound() {
        val players = mutableListOf<FakePlayer>()
        val playback = AlarmToneFallback(listOf("custom", "packaged"), {
            FakePlayer().also { players.add(it) }
        })
        playback.start()
        playback.stop()
        playback.stop()
        players[0].ready()
        players[0].failed()
        assertEquals(1, players.size)
        assertEquals(0, players[0].starts)
        assertEquals(1, players[0].releases)
    }
}
