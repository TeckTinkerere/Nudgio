package com.aslam.mediareminder.bridge

import com.aslam.mediareminder.backup.BackupCommitResult
import com.aslam.mediareminder.backup.BackupInspectionResult
import com.aslam.mediareminder.backup.ExportOutcome
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/** `backup/` domain results -> the MR-08 `ExportResult`/`BackupInspection`/`MutationResult` wire shapes. */
object BackupDtoWriter {
    fun writeExportResult(outcome: ExportOutcome): WritableMap = Arguments.createMap().apply {
        putString("fileName", outcome.fileName)
        putString("sizeBytes", outcome.sizeBytes.toString())
        putString("sha256", outcome.sha256)
    }

    fun writeInspection(result: BackupInspectionResult): WritableMap = Arguments.createMap().apply {
        putString("archiveVersion", result.archiveVersion)
        putString("createdAt", result.createdAt)
        putString("sourceAppVersion", result.sourceAppVersion)
        putInt("mediaCount", result.mediaCount)
        putInt("reminderCount", result.reminderCount)
        putString("compressedBytes", result.compressedBytes.toString())
        putString("expectedUncompressedBytes", result.expectedUncompressedBytes.toString())
        putString("checksumStatus", result.checksumStatus)
        putString("compatibility", result.compatibility)
        putArray(
            "conflicts",
            Arguments.createArray().apply {
                // MR-08 `ConflictSummary` is aggregated per kind (kind +
                // count + one resolution key) — the richer per-item
                // local/archive detail `BackupConflictPlanner` computes is
                // used internally to decide the plan's defaults, not
                // surfaced through this DTO (no such itemized shape exists
                // in the current bridge contract).
                result.conflicts.groupBy { it.kind }.forEach { (kind, conflictsOfKind) ->
                    pushMap(
                        Arguments.createMap().apply {
                            putString("kind", kind)
                            putInt("count", conflictsOfKind.size)
                            putString("resolutionKey", "backup.conflict.${conflictsOfKind.first().recommendedAction}")
                        },
                    )
                }
            },
        )
        putArray("warnings", Arguments.createArray().apply { result.warnings.forEach { pushString(it) } })
        putString("importToken", result.importToken)
        // Also exposed for the JS operationId <-> importToken correlation
        // the import screen needs before calling commitImport.
        putString("operationId", result.operationId)
    }

    fun writeCommitResult(result: BackupCommitResult): WritableMap = Arguments.createMap().apply {
        putString("status", result.status)
        putInt("affectedCount", result.affectedCount)
    }
}
