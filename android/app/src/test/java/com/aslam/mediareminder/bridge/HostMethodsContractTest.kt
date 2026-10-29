package com.aslam.mediareminder.bridge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * The Kotlin half of the host contract check: [HostMethods] must equal
 * `contract/host_methods.json`, which the Dart test suite generates from
 * `lib/native/host_contract.dart` and the Swift suite checks too.
 */
class HostMethodsContractTest {

    private val contract: JSONObject by lazy {
        // Gradle runs unit tests from the module directory (android/app).
        val file = generateSequence(File("").absoluteFile) { it.parentFile }
            .map { File(it, "contract/host_methods.json") }
            .first { it.exists() }
        JSONObject(file.readText())
    }

    @Test
    fun methodTableMatchesTheContractFile() {
        val methods = contract.getJSONObject("methods")
        val expected = methods.keys().asSequence().associateWith { name ->
            val args = methods.getJSONArray(name)
            (0 until args.length()).map { args.getString(it) }
        }
        assertEquals(expected, HostMethods.ARGUMENTS)
    }

    @Test
    fun channelNamesAndVersionMatch() {
        assertEquals(contract.getString("hostChannel"), NudgioPlugin.HOST_CHANNEL)
        assertEquals(contract.getString("eventChannel"), NudgioPlugin.EVENT_CHANNEL)
        assertEquals(contract.getInt("contractVersion"), HostMethods.CONTRACT_VERSION)
    }
}
