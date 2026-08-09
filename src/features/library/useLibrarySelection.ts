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
import {useExportMedia} from './useExportMedia';
import {useToast} from '../../app/toast/ToastProvider';
import {useTranslation} from '../../localization';
import type {UUID} from '../../native-client/types';

export type LibraryBulkAction = 'export' | 'delete';

export function useLibrarySelection() {
  const t = useTranslation();
  const {showToast} = useToast();
  const exportMedia = useExportMedia();
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
        ids.map(id => deleteMedia.mutateAsync({id, cascadeDeleteReminders: true})),
      );
      if (results.some(result => result.status === 'rejected')) {
        throw new Error('One or more selected assets failed to delete');
      }
    },
    [deleteMedia],
  );

  const handleBulkAction = useCallback(
    (action: LibraryBulkAction) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) {
        showToast({
          message: t('library.selection.emptyWarning'),
          tone: 'info',
          haptic: 'warning',
        });
        return;
      }

      const run = action === 'export' ? exportMedia.mutateAsync(ids) : runDelete(ids);
      // eslint-disable-next-line no-void -- fire-and-forget: UI feedback is toast-driven, not awaited by the caller.
      void run
        .then(() => {
          showToast({
            message: t(
              action === 'export' ? 'library.selection.exportSuccess' : 'library.selection.deleteSuccess',
              {count: ids.length},
            ),
            tone: 'success',
          });
          exitSelection();
        })
        .catch(() => {
          // Selection stays intact on failure so the user can retry without reselecting.
          showToast({
            message: t(
              action === 'export' ? 'library.selection.exportError' : 'library.selection.deleteError',
            ),
            tone: 'error',
          });
        });
    },
    [exitSelection, exportMedia, runDelete, selectedIds, showToast, t],
  );

  return {
    selectionMode,
    selectedIds,
    enterSelection,
    exitSelection,
    toggleSelected,
    handleBulkAction,
  };
}
