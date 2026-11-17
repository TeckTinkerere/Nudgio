package com.aslam.mediareminder.bridge.wire

/**
 * The wire value types the Kotlin core builds its MR-08 DTOs with.
 *
 * Until ADR-023 these were React Native's `WritableMap`/`ReadableMap`/
 * `WritableArray`/`ReadableArray`/`Promise`, and sixteen files (DTO writers,
 * request readers, services) were written against that API. Rather than
 * rewrite every one of them during the Flutter host swap (plan F2), this file
 * reproduces the subset of the API they use over plain Kotlin collections, and
 * the swap is an import change. A DTO writer produces exactly the map it did
 * before, which is what keeps the swap behavior-neutral (plan §12, top risk).
 *
 * The values are what Flutter's `StandardMessageCodec` carries: `null`,
 * `Boolean`, `Int`/`Long`, `Double`, `String`, `List` and `Map`.
 * [toPlatform] turns a [WireMap]/[WireArray] tree into those, and
 * [WireMap.fromPlatform] wraps an incoming argument.
 *
 * Numbers follow React Native's reading rules: the old bridge delivered every
 * JS number as a `Double`, so readers call [WireMap.getDouble] even for
 * integral fields such as `entityVersion`. Dart sends an `int`, so every
 * numeric getter accepts any [Number].
 */
class WireMap internal constructor(private val values: MutableMap<String, Any?>) {

    constructor() : this(LinkedHashMap())

    fun hasKey(name: String): Boolean = values.containsKey(name)

    fun isNull(name: String): Boolean = values[name] == null

    fun getString(name: String): String? = values[name] as String?

    fun getBoolean(name: String): Boolean = values[name] as Boolean

    fun getDouble(name: String): Double = (values[name] as Number).toDouble()

    fun getInt(name: String): Int = (values[name] as Number).toInt()

    fun getLong(name: String): Long = (values[name] as Number).toLong()

    fun getMap(name: String): WireMap? = wrap(values[name]) as WireMap?

    fun getArray(name: String): WireArray? = wrap(values[name]) as WireArray?

    fun toHashMap(): HashMap<String, Any?> = HashMap(values.mapValues { (_, value) -> toPlatform(value) })

    fun putString(name: String, value: String?) { values[name] = value }

    fun putBoolean(name: String, value: Boolean) { values[name] = value }

    fun putInt(name: String, value: Int) { values[name] = value }

    fun putLong(name: String, value: Long) { values[name] = value }

    fun putDouble(name: String, value: Double) { values[name] = value }

    fun putNull(name: String) { values[name] = null }

    fun putMap(name: String, value: WireMap?) { values[name] = value }

    fun putArray(name: String, value: WireArray?) { values[name] = value }

    override fun equals(other: Any?): Boolean = other is WireMap && toPlatform(this) == toPlatform(other)

    override fun hashCode(): Int = toPlatform(this).hashCode()

    override fun toString(): String = "WireMap(${values.keys})"

    companion object {
        /** Wraps a channel argument; `null` or a non-map becomes an empty map, so request validation still runs. */
        fun fromPlatform(value: Any?): WireMap = (wrap(value) as? WireMap) ?: WireMap()
    }
}

class WireArray internal constructor(private val values: MutableList<Any?>) {

    constructor() : this(ArrayList())

    fun size(): Int = values.size

    fun isNull(index: Int): Boolean = values[index] == null

    fun getString(index: Int): String? = values[index] as String?

    fun getBoolean(index: Int): Boolean = values[index] as Boolean

    fun getDouble(index: Int): Double = (values[index] as Number).toDouble()

    fun getInt(index: Int): Int = (values[index] as Number).toInt()

    fun getMap(index: Int): WireMap? = wrap(values[index]) as WireMap?

    fun getArray(index: Int): WireArray? = wrap(values[index]) as WireArray?

    fun toArrayList(): ArrayList<Any?> = ArrayList(values.map(::toPlatform))

    fun pushString(value: String?) { values.add(value) }

    fun pushBoolean(value: Boolean) { values.add(value) }

    fun pushInt(value: Int) { values.add(value) }

    fun pushDouble(value: Double) { values.add(value) }

    fun pushNull() { values.add(null) }

    fun pushMap(value: WireMap?) { values.add(value) }

    fun pushArray(value: WireArray?) { values.add(value) }

    override fun equals(other: Any?): Boolean = other is WireArray && toPlatform(this) == toPlatform(other)

    override fun hashCode(): Int = toPlatform(this).hashCode()

    companion object {
        fun fromPlatform(value: Any?): WireArray = (wrap(value) as? WireArray) ?: WireArray()
    }
}

/** The React Native names the core was written against; see the file doc. */
typealias WritableMap = WireMap
typealias ReadableMap = WireMap
typealias WritableArray = WireArray
typealias ReadableArray = WireArray

object Arguments {
    fun createMap(): WireMap = WireMap()

    fun createArray(): WireArray = WireArray()
}

/**
 * One pending host call. Resolved or rejected exactly once, from any thread;
 * the channel adapter (`NudgioHostChannel`) moves the answer to the main
 * thread, where Flutter requires it.
 */
interface Promise {
    fun resolve(value: Any?)

    /** [userInfo] is the MR-08 envelope (`NativeErrorEnvelope.reject`). */
    fun reject(code: String, message: String?, userInfo: WireMap?)
}

/** A wire tree as `StandardMessageCodec` values. */
fun toPlatform(value: Any?): Any? = when (value) {
    is WireMap -> value.toHashMap()
    is WireArray -> value.toArrayList()
    else -> value
}

@Suppress("UNCHECKED_CAST")
private fun wrap(value: Any?): Any? = when (value) {
    null, is WireMap, is WireArray -> value
    is Map<*, *> -> WireMap(LinkedHashMap((value as Map<String, Any?>)))
    is List<*> -> WireArray(ArrayList(value))
    else -> value
}
