/**
 * MR-03 "Edit details" — rename and edit notes for one media item.
 *
 * Owns its own draft state (title/notes) and the `useUpdateMedia` mutation,
 * seeded from `media` each time it opens (`useEffect` keyed on `visible`) —
 * extracted out of `MediaDetailScreen` purely to keep that screen's own
 * branching (pending/error/normal states, delete confirmation) readable; this
 * dialog's state has no other reason to live in the parent.
 */
import {useEffect, useState} from 'react';

import {useUpdateMedia} from './useUpdateMedia';
import {Dialog, Stack, TextField} from '../../design-system';
import {useTranslation} from '../../localization';
import type {MediaDetail} from '../../native-client/types';

export interface RenameMediaDialogProps {
  readonly visible: boolean;
  readonly media: MediaDetail;
  readonly onDismiss: () => void;
}

export function RenameMediaDialog({visible, media, onDismiss}: RenameMediaDialogProps) {
  const t = useTranslation();
  const updateMedia = useUpdateMedia();
  const [title, setTitle] = useState(media.title);
  const [notes, setNotes] = useState(media.notes ?? '');

  // Re-seed the draft from the latest server value each time the dialog
  // opens, rather than on every `media` change — otherwise a background
  // refetch mid-edit would overwrite what the user is typing.
  useEffect(() => {
    if (visible) {
      setTitle(media.title);
      setNotes(media.notes ?? '');
    }
  }, [visible, media.title, media.notes]);

  const save = () => {
    if (title.trim().length === 0) {
      return;
    }
    updateMedia.mutate(
      {id: media.id, title: title.trim(), notes: notes.trim()},
      {onSuccess: onDismiss},
    );
  };

  return (
    <Dialog
      visible={visible}
      title={t('library.detail.renameTitle')}
      body={t('library.detail.renameBody')}
      cancel={{label: t('action.cancel'), onPress: onDismiss}}
      confirm={{label: t('action.save'), onPress: save}}>
      <Stack gap="sm">
        <TextField
          label={t('library.detail.titleLabel')}
          placeholder={t('library.detail.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          required
          error={
            title.trim().length === 0
              ? t('library.detail.renameValidationTitleRequired')
              : undefined
          }
        />
        <TextField
          label={t('library.detail.notes')}
          placeholder={t('library.detail.notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Stack>
    </Dialog>
  );
}
