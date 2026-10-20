/**
 * Library selection-mode state + bulk actions (MR-03 "Library" selection
 * spec): tracks which asset ids are checked, and drives the bulk
 * Export/Delete flow's toast/haptic feedback. Pulled out of `LibraryScreen`
 * so the screen component itself stays a thin render — this is where all the
 * "0 selected", "action failed, keep selection", "action succeeded, exit
 * selection" branching lives.
 */
import {useCallback, useState} from 'react';

import {useDeleteMedia} from './useDeleteMedia';
import {useSaveSelectionToGallery} from './useSaveSelectionToGallery';
import {useShareLibrarySelection} from './useShareLibrarySelection';
import {useToast} from '../../app/toast/ToastProvider';
import type {AppError} from '../../core/errors';
import {useTranslation, type TranslationKey} from '../../localization';
import type {GallerySaveSummary, UUID} from '../../native-client/types';

export type LibraryBulkAction = 'export' | 'delete';

export interface SelectionToast {
  readonly key: TranslationKey;
  readonly params?: Record<string, number>;
  readonly tone: 'success' | 'info' | 'error';
}

/**
 * What to tell the user after "Save to gallery": the counts decide, so a
 * partial failure, a repeat save and a notes-only selection each read as
 * what actually happened.
 */
export function describeGallerySave(summary: GallerySaveSummary): SelectionToast {
  if (summary.status === 'limited') {
    return {key: 'library.selection.gallery.unsupported', tone: 'error'};
  }
  if (summary.failedCount > 0) {
    return summary.savedCount > 0
      ? {
          key: 'library.selection.gallery.partial',
          params: {saved: summary.savedCount, failed: summary.failedCount},
          tone: 'error',
        }
      : {key: 'library.selection.gallery.error', tone: 'error'};
  }
  if (summary.savedCount > 0) {
    return {key: 'library.selection.gallery.done', params: {count: summary.savedCount}, tone: 'success'};
  }
  if (summary.alreadySavedCount > 0) {
    return {key: 'library.selection.gallery.alreadySaved', tone: 'info'};
  }
  return {key: 'library.selection.gallery.nothingToSave', tone: 'info'};
}

/** The same storage-full code the importer uses; the zip and the gallery copy both need room. */
const isOutOfSpace = (error: unknown) => (error as Partial<AppError> | null)?.code === 'MR_STORAGE_INSUFFICIENT';

export function useLibrarySelection() {
  const t = useTranslation();
  const {showToast} = useToast();
  const shareSelection = useShareLibrarySelection();
  const saveToGallery = useSaveSelectionToGallery();
  const deleteMedia = useDeleteMedia();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<UUID>>(new Set());

  const enterSelection = useCallback(() => setSelectionMode(true), []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: UUID) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const runDelete = useCallback(
    async (ids: readonly UUID[]) => {
      const results = await Promise.allSettled(
        ids.map(id => deleteMedia.mutateAsync({id, cascadeDeleteReminders: false})),
      );
      if (results.some(result => result.status === 'rejected')) {
        throw new Error('One or more selected assets failed to delete');
      }
    },
    [deleteMedia],
  );

  /**
   * `export` shares the media selection plus any selected [folderIds]; it
   * resolves once the OS share sheet is open. `delete` acts on the selected
   * media only (the screen removes folders itself).
   */
  const handleBulkAction = useCallback(
    (action: LibraryBulkAction, folderIds: readonly UUID[] = []) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 && folderIds.length === 0) {
        showToast({
          message: t('library.selection.emptyWarning'),
          tone: 'info',
          haptic: 'warning',
        });
        return Promise.resolve(false);
      }

      if (action === 'export') {
        return shareSelection
          .mutateAsync({mediaIds: ids, folderIds})
          .then(result => {
            const zipped = result.affectedCount > 1 || folderIds.length > 0;
            showToast({
              message: t(zipped ? 'library.selection.shareZipSuccess' : 'library.selection.shareSuccess', {
                count: result.affectedCount,
              }),
              tone: 'success',
            });
            exitSelection();
            return true;
          })
          .catch(error => {
            // Selection stays intact so the user can retry without reselecting.
            showToast({
              message: t(isOutOfSpace(error) ? 'library.selection.shareNoSpace' : 'library.selection.shareError'),
              tone: 'error',
            });
            return false;
          });
      }

      return runDelete(ids)
        .then(() => {
          showToast({message: t('library.selection.deleteSuccess', {count: ids.length}), tone: 'success'});
          exitSelection();
          return true;
        })
        .catch(() => {
          // Selection stays intact on failure so the user can retry without reselecting.
          showToast({message: t('library.selection.deleteError'), tone: 'error'});
          return false;
        });
    },
    [exitSelection, runDelete, selectedIds, shareSelection, showToast, t],
  );

  /** "Save to gallery" for the selected media and [folderIds]; the toast says what the counts add up to. */
  const handleSaveToGallery = useCallback(
    (folderIds: readonly UUID[] = []) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 && folderIds.length === 0) {
        showToast({message: t('library.selection.emptyWarning'), tone: 'info', haptic: 'warning'});
        return Promise.resolve(false);
      }
      return saveToGallery
        .mutateAsync({mediaIds: ids, folderIds})
        .then(summary => {
          const toast = describeGallerySave(summary);
          showToast({message: t(toast.key, toast.params), tone: toast.tone});
          if (toast.tone !== 'error') {
            exitSelection();
          }
          return toast.tone !== 'error';
        })
        .catch(error => {
          showToast({
            message: t(isOutOfSpace(error) ? 'library.selection.gallery.noSpace' : 'library.selection.gallery.error'),
            tone: 'error',
          });
          return false;
        });
    },
    [exitSelection, saveToGallery, selectedIds, showToast, t],
  );

  return {
    selectionMode,
    selectedIds,
    enterSelection,
    exitSelection,
    toggleSelected,
    handleBulkAction,
    handleSaveToGallery,
  };
}
