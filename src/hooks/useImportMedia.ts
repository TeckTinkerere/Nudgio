/**
 * "Import media" end to end: pick one or more files, then stream each in.
 *
 * Multi-select (DL-109): the picker returns up to `MAX_IMPORT_BATCH` files
 * and they are imported one after another, each its own native import with
 * its own journal entry and progress — never one combined copy, so one bad
 * file cannot take the others with it.
 *
 * Files shared in from another app (DL-110 "Share to Nudgio") take the same
 * path with the picker step skipped: pass `{documents}` instead of MIME types.
 *
 * MR-09's 500 MB soft warning is finally shown (DL-110): when any chosen file
 * is over it, `largeFilePrompt` holds the batch until the user confirms, and
 * `ImportPrompts` renders the question.
 *
 * Two bridge calls chained into one mutation because they are one user
 * action ("Import media" — MR-03 "Import flow" steps 1-2 happen inside
 * `pickDocuments`, steps 3-5 inside `beginMediaImport`), and because a picker
 * cancellation has to be distinguishable from an import failure: backing out
 * of the system picker resolves an empty list (MR-08 — not an error), while
 * every real failure after that point is a thrown `AppError` `unwrapResult`
 * surfaces as the mutation's `error`.
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
import {useEffect, useRef, useState} from 'react';

import {useAppMutation} from './useAppMutation';
import {useAppQueryClient} from './useAppQueryClient';
import {useOperationProgress} from './useOperationProgress';
import {useAppContainer} from '../app/di';
import {useToast} from '../app/toast/ToastProvider';
import {appConfig} from '../core/config/appConfig';
import type {AppError} from '../core/errors';
import {queryKeys, unwrapResult} from '../core/state';
import {useTranslation, type TranslationKey} from '../localization';
import type {MediaDetail, PickedDocument, UUID} from '../native-client/types';

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
 * Native reports an over-2 GB file under `MR_STORAGE_INSUFFICIENT` too, with
 * this reason code as `field` (`MediaReminderModule.mediaImportErrorEnvelope`).
 * It needs its own copy: "free up space" is no help for a file that can never
 * fit, and was the wrong advice every time a long 4K video was picked.
 */
const TOO_LARGE_FIELD = 'media_import_too_large';

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
  if (error.field === TOO_LARGE_FIELD) {
    return {
      titleKey: 'error.unexpected.title',
      bodyKey: 'library.import.errorTooLarge',
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

/** Mirrors native `MediaPicker.MAX_BATCH_ITEMS`; native clamps to it either way. */
export const MAX_IMPORT_BATCH = 20;

export interface ImportMediaOutcome {
  readonly status: 'imported' | 'noSelection';
  /** The first file imported — what a caller holding one item (the reminder editor) attaches. */
  readonly media?: MediaDetail;
  /** Every file imported, in the order the picker returned them. */
  readonly items: readonly MediaDetail[];
  /** Picked files that were not added, including any skipped after the batch stopped. */
  readonly failedCount: number;
}

/** What to import: MIME types to open the picker with, or files already in hand (a share). */
export type ImportMediaRequest = readonly string[] | {readonly documents: readonly PickedDocument[]} | void;

/** A batch waiting on "these files are large — import anyway?". */
export interface LargeFilePrompt {
  readonly count: number;
  readonly largestBytes: number;
  readonly confirm: () => void;
  readonly decline: () => void;
}

/** Files over MR-09's soft warning size. Unknown sizes are not guessed at. */
export const largeFiles = (documents: readonly PickedDocument[]): readonly PickedDocument[] =>
  documents.filter(document => Number(document.sizeBytes ?? 0) > appConfig.storage.assetSoftWarningBytes);

/** Position within a multi-file import, 1-based for display. */
export interface ImportBatchPosition {
  readonly current: number;
  readonly total: number;
}

/**
 * Stop the batch rather than try the next file: a user cancel, or no space —
 * the next file would only fail the same way.
 */
const endsBatch = (error: AppError): boolean =>
  error.field === 'cancelled' ||
  (error.code === 'MR_STORAGE_INSUFFICIENT' && error.field !== TOO_LARGE_FIELD);

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
  const {showToast} = useToast();
  const t = useTranslation();
  const [operationId, setOperationId] = useState<UUID | null>(null);
  const [batch, setBatch] = useState<ImportBatchPosition | null>(null);
  const [largeFilePrompt, setLargeFilePrompt] = useState<LargeFilePrompt | null>(null);
  // A ref, not state: the loop below reads it between files, inside one
  // mutation run that would otherwise only ever see its first render's value.
  const stopRequested = useRef(false);

  /** Resolves true to import, false to back out; the dialog is `ImportPrompts`. */
  const confirmLargeFiles = (large: readonly PickedDocument[]) =>
    new Promise<boolean>(resolve => {
      const settle = (proceed: boolean) => {
        setLargeFilePrompt(null);
        resolve(proceed);
      };
      setLargeFilePrompt({
        count: large.length,
        largestBytes: Math.max(...large.map(document => Number(document.sizeBytes ?? 0))),
        confirm: () => settle(true),
        decline: () => settle(false),
      });
    });

  const mutation = useAppMutation<ImportMediaOutcome, ImportMediaRequest>({
    mutationFn: async request => {
      stopRequested.current = false;
      const picked = request && 'documents' in request
        ? request.documents.slice(0, MAX_IMPORT_BATCH)
        : await unwrapResult(() =>
          repositories.media.pickDocuments(request ?? DEFAULT_MIME_TYPES, MAX_IMPORT_BATCH),
        );
      if (picked.length === 0) {
        return {status: 'noSelection', items: [], failedCount: 0};
      }
      const large = largeFiles(picked);
      if (large.length > 0 && !(await confirmLargeFiles(large))) {
        return {status: 'noSelection', items: [], failedCount: 0};
      }

      const items: MediaDetail[] = [];
      let firstError: AppError | undefined;
      for (const [index, document] of picked.entries()) {
        if (stopRequested.current) {
          break;
        }
        setBatch({current: index + 1, total: picked.length});
        try {
          items.push(
            await unwrapResult(() =>
              repositories.media.beginImport({
                sourceUri: document.uriToken,
                displayName: document.displayName,
                mimeType: document.mimeType,
                sizeBytes: document.sizeBytes,
              }),
            ),
          );
        } catch (error) {
          const appError = error as AppError;
          firstError ??= appError;
          if (endsBatch(appError)) {
            break;
          }
        }
      }

      // Nothing landed: surface the reason exactly as a single import would.
      if (items.length === 0) {
        throw firstError;
      }
      return {status: 'imported', media: items[0], items, failedCount: picked.length - items.length};
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
      const count = outcome.items.length;
      if (outcome.failedCount > 0) {
        showToast({
          message: t('library.import.partial', {imported: count, failed: outcome.failedCount}),
          tone: 'error',
        });
        return;
      }
      showToast({
        message: count === 1 ? t('library.import.successOne') : t('library.import.success', {count}),
        tone: 'success',
      });
    },
    onSettled: () => setBatch(null),
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
    stopRequested.current = true;
    if (operationId) {
      // Fire-and-forget: the running copy loop checks cancellation
      // cooperatively (MR-10) and the mutation itself settles from the
      // `beginMediaImport` promise rejecting, not from this call resolving.
      // eslint-disable-next-line no-void
      void repositories.media.cancelOperation(operationId);
    }
  };

  // One bar for the whole batch: finished files count whole, the current one
  // by its own byte fraction. A single file of unknown size stays indeterminate.
  const itemFraction = importProgressFraction(progress);
  const multiple = batch !== null && batch.total > 1;
  const progressFraction = multiple
    ? (batch.current - 1 + (itemFraction ?? 0)) / batch.total
    : itemFraction;
  const phaseLabel = t(importPhaseLabelKey(progress?.phase) ?? 'library.import.copying');
  const progressLabel = multiple
    ? t('library.import.batchProgress', {phase: phaseLabel, current: batch.current, total: batch.total})
    : phaseLabel;

  return {
    importMedia: mutation.mutate,
    importMediaAsync: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    progressFraction,
    progressLabel,
    batch,
    largeFilePrompt,
    cancel,
    error: mutation.error,
    reset: mutation.reset,
  };
};
