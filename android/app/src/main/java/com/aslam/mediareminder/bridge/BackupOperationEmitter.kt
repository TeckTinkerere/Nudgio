package com.aslam.mediareminder.bridge

import android.content.Context
import com.aslam.mediareminder.backup.BackupProgress

/**
 * Adapts the backup engine's [BackupProgress] onto the shared
 * [OperationProgressEmitter].
 *
 * Kept as its own entry point so the backup call sites read in backup terms and
 * do not have to destructure a progress object into eight arguments. The actual
 * event construction and — importantly — the per-operation `sequence` counter
 * live in [OperationProgressEmitter], because media import emits against the
 * same `operationProgress` event and a second counter map would make the
 * sequence appear to jump backwards between operation kinds (MR-08 uses
 * `sequence` for dropped-event detection).
 */
object BackupOperationEmitter {

    fun emit(
        context: Context,
        operationId: String,
        kind: String,
        progress: BackupProgress,
        cancellable: Boolean,
    ) = OperationProgressEmitter.emit(
        context = context,
        operationId = operationId,
        kind = kind,
        phase = progress.phase,
        cancellable = cancellable,
        completedBytes = progress.completedBytes,
        totalBytes = progress.totalBytes,
        currentItemIndex = progress.currentItemIndex,
        totalItems = progress.totalItems,
    )

    fun clear(operationId: String) = OperationProgressEmitter.clear(operationId)
}
