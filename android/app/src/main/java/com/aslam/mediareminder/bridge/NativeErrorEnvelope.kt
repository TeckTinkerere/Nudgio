package com.aslam.mediareminder.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import java.util.UUID

/**
 * The Kotlin-side encoder for the MR-08 `NativeErrorEnvelope`.
 *
 * TypeScript's `toAppError()` (`src/core/errors/toAppError.ts`) decodes
 * exactly this shape. Every promise rejection in this module goes through
 * [reject] so the four required layers — code, message key, category,
 * correlation ID — are never accidentally omitted, and so a raw exception
 * message (which might contain a file path) never becomes the rejection
 * reason.
 */
object NativeErrorEnvelope {

    enum class Category(val wireValue: String) {
        VALIDATION("validation"),
        CAPABILITY("capability"),
        STORAGE("storage"),
        MEDIA("media"),
        SCHEDULE("schedule"),
        BACKUP("backup"),
        SECURITY("security"),
        INTERNAL("internal"),
    }

    /**
     * MR-07: every diagnostic/error correlation ID is a fresh UUID, never
     * reused across unrelated failures, so a support conversation can
     * pinpoint one event in the local diagnostic log.
     */
    private fun newCorrelationId(): String = UUID.randomUUID().toString()

    fun reject(
        promise: Promise,
        code: String,
        messageKey: String,
        category: Category,
        retryable: Boolean = false,
        field: String? = null,
    ) {
        val userInfo: WritableMap = Arguments.createMap().apply {
            putString("code", code)
            putString("messageKey", messageKey)
            putString("category", category.wireValue)
            putBoolean("retryable", retryable)
            putString("correlationId", newCorrelationId())
            if (field != null) putString("field", field)
        }
        promise.reject(code, messageKey, userInfo)
    }

    /**
     * The declared-but-unimplemented surface (MR-08 note in
     * `NativeMediaReminder.ts`): reminder CRUD, import/export, backup and
     * alarm actions all reject identically until their owning slice lands.
     */
    fun rejectNotImplemented(promise: Promise, method: String) {
        reject(
            promise = promise,
            code = "MR_INTERNAL_FAILED_SAFE",
            messageKey = "error.notImplemented",
            category = Category.INTERNAL,
            retryable = false,
            field = method,
        )
    }
}
