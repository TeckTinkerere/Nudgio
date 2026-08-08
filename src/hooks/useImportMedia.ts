/**
 * "Import media" end to end: pick a file, then stream it in.
 *
 * Two bridge calls chained into one mutation because they are one user
 * action ("Import media" — MR-03 "Import flow" steps 1-2 happen inside
 * `pickDocument`, steps 3-5 inside `beginMediaImport`), and because a picker
 * cancellation has to be distinguishable from an import failure: backing out
 * of the system picker is `PickedDocument | null` resolving `null` (MR-08 —
 * not an error), while every real failure after that point is a thrown
 * `AppError` `unwrapResult` surfaces as the mutation's `error`.
 *
 * `operationId` is learned from the first `operationProgress` event, the
 * same pattern `BackupScreen` already established for export — the id is not
 * returned by any promise, since `beginMediaImport` only resolves once the
 * whole import is done.
 *
 * Lives in `src/hooks/`, not a feature folder: both Today and Library have
 * an "Import media" entry point, and this is the bridge-level use case
 * behind both, not a Library-screen-specific concern.
 */
import {useEffect, useState} from 'react';

import {useAppMutation} from './useAppMutation';
import {useAppQueryClient} from './useAppQueryClient';
import {useOperationProgress} from './useOperationProgress';
import {useAppContainer} from '../app/di';
import type {AppError} from '../core/errors';
import {queryKeys, unwrapResult} from '../core/state';
import type {TranslationKey} from '../localization';
import type {MediaDetail, UUID} from '../native-client/types';

/**
 * MR-08 progress phase -> the exact MR-03 copy keys already seeded in
 * `en.ts` for this flow. `undefined` for a phase this UI has no copy for yet
 * (`creating_preview` — thumbnails are not built, see `MediaDtoWriter`), so
 * callers fall back to a generic label rather than showing nothing.
 */
const PHASE_LABEL_KEY: Record<string, TranslationKey | undefined> = {
  copying: 'library.import.copying',
  checking: 'library.import.checking',
  creating_preview: 'library.import.creatingPreview',
  ready: 'library.import.ready',
};

export const importPhaseLabelKey = (
  phase: string | undefined,
): TranslationKey | undefined => (phase ? PHASE_LABEL_KEY[phase] : undefined);

/**
 * 0..1 for `ProgressBar`, or `undefined` (indeterminate) when the total is
 * unknown — some content providers never report a size, and `MediaImporter`
 * proceeds anyway rather than blocking on it (see its own doc comment).
 * `Number()` on these decimal strings loses precision only past
 * `Number.MAX_SAFE_INTEGER` bytes, far beyond MR-09's 2 GB per-asset cap, so
 * that never matters here.
 */
export const importProgressFraction = (
  progress: {readonly completedUnits?: string; readonly totalUnits?: string} | null,
): number | undefined => {
  if (!progress?.completedUnits || !progress.totalUnits) {
    return undefined;
  }
  const total = Number(progress.totalUnits);
  if (total <= 0) {
    return undefined;
  }
  return Math.min(1, Number(progress.completedUnits) / total);
};

/**
 * MR-03's exact listed import error copy, keyed by the MR-08 wire code
 * `beginMediaImport`'s rejection carries. `field === 'cancelled'` is checked
 * first because Kotlin reports a user cancellation as `MR_VALIDATION_FAILED`
 * (see `MediaReminderModule.beginMediaImport`'s catch clause) — the same code
 * a genuine validation fault could carry, so the code alone can't tell them
 * apart.
 */
export const importErrorCopy = (
  error: AppError,
): {readonly titleKey: TranslationKey; readonly bodyKey: TranslationKey} => {
  if (error.field === 'cancelled') {
    return {
      titleKey: 'error.unexpected.title',
      bodyKey: 'library.import.errorCancelled',
    };
  }
  switch (error.code) {
    case 'MR_MEDIA_UNSUPPORTED_TYPE':
      return {
        titleKey: 'error.unexpected.title',
        bodyKey: 'library.import.errorUnsupportedType',
      };
    case 'MR_MEDIA_UNAVAILABLE':
      return {
        titleKey: 'error.unexpected.title',
        bodyKey: 'library.import.errorUnreadable',
      };
    case 'MR_STORAGE_INSUFFICIENT':
      return {
        titleKey: 'error.unexpected.title',
        bodyKey: 'library.import.errorInsufficientSpace',
      };
    default:
      return {titleKey: 'error.unexpected.title', bodyKey: 'error.unexpected.effect'};
  }
};

/**
 * MR-09 "Storage limits": "maintain 250 MB... whichever is greater" is the
 * one number in that rule guaranteed to be a true lower bound regardless of
 * the file or the 5%-of-total floor, so it is what `errorInsufficientSpace`'s
 * `{megabytes}` interpolates — not a computed "exactly this many MB", which
 * this layer has no way to know (the native rejection carries a reason code,
 * not a byte count).
 */
export const STORAGE_INSUFFICIENT_MIN_MB = 250;

export interface ImportMediaOutcome {
  readonly status: 'imported' | 'noSelection';
  readonly media?: MediaDetail;
}

/**
 * MR-05's import table lists Photo Picker as the mechanism for video/image;
 * audio explicitly requires the document picker instead. Defaulting to
 * visual kinds here matches what a single, unlabeled "Import media" action
 * can reasonably request — a kind-specific entry point (e.g. "Import audio")
 * is a separate follow-up, not a gap in this one.
 */
const DEFAULT_MIME_TYPES: readonly string[] = ['image/*', 'video/*'];

export const useImportMedia = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const [operationId, setOperationId] = useState<UUID | null>(null);

  const mutation = useAppMutation<ImportMediaOutcome, readonly string[] | void>({
    mutationFn: async mimeTypes => {
      const picked = await unwrapResult(() =>
        repositories.media.pickDocument(mimeTypes ?? DEFAULT_MIME_TYPES),
      );
      if (picked === null) {
        return {status: 'noSelection'};
      }
      const media = await unwrapResult(() =>
        repositories.media.beginImport({
          sourceUri: picked.uriToken,
          displayName: picked.displayName,
          mimeType: picked.mimeType,
          sizeBytes: picked.sizeBytes,
        }),
      );
      return {status: 'imported', media};
    },
    onSuccess: outcome => {
      if (outcome.status !== 'imported') {
        return;
      }
      // A new row changes counts and sort order in ways a local cache patch
      // can't cheaply reproduce (same reasoning as `useSaveReminder`) —
      // invalidate the whole media list plus the startup snapshot's count.
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.media.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
    },
  });

  const progress = useOperationProgress('import', mutation.isPending);

  useEffect(() => {
    if (!mutation.isPending) {
      setOperationId(null);
      return;
    }
    if (progress?.operationId) {
      setOperationId(progress.operationId as UUID);
    }
  }, [mutation.isPending, progress?.operationId]);

  const cancel = () => {
    if (operationId) {
      // Fire-and-forget: the running copy loop checks cancellation
      // cooperatively (MR-10) and the mutation itself settles from the
      // `beginMediaImport` promise rejecting, not from this call resolving.
      // eslint-disable-next-line no-void
      void repositories.media.cancelOperation(operationId);
    }
  };

  return {
    importMedia: mutation.mutate,
    isImporting: mutation.isPending,
    progress,
    cancel,
    error: mutation.error,
    reset: mutation.reset,
  };
};
