/**
 * Dedicated "Edit Media Asset" screen (spec: "an Edit icon button beside the
 * name of every imported asset ... opens that asset's Edit Media Asset page
 * — a dedicated screen, not just the existing rename dialog"). Replaces the
 * previous `RenameMediaDialog` popup entirely: same title/notes fields and
 * the same `useUpdateMedia` mutation, but as a full pushed screen with its
 * own preview so editing a long note isn't cramped into a small dialog box.
 *
 * Thin wrapper (`EditMediaAssetScreen`) gates on `useMediaDetail`'s
 * loading/error states before ever mounting the form
 * (`EditMediaAssetForm`), same split `ReminderEditorScreen` uses — the form
 * only ever sees an already-resolved `MediaDetail`, so its own draft state
 * never has to reconcile with an in-flight fetch.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {Image, StyleSheet} from 'react-native';

import {useMediaDetail} from './useMediaDetail';
import {useUpdateMedia} from './useUpdateMedia';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {testIds} from '../../constants';
import {
  AppBar,
  Button,
  Card,
  Dialog,
  ErrorState,
  LoadingState,
  Screen,
  Stack,
  TextField,
} from '../../design-system';
import {useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaDetail} from '../../native-client/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMediaAsset'>;

export function EditMediaAssetScreen({navigation, route}: Props) {
  const t = useTranslation();
  const media = useMediaDetail(route.params.mediaId);
  const back = {label: t('action.back'), onPress: () => navigation.goBack()};

  if (media.isPending) {
    return (
      <Screen hasAppBar testID={testIds.library.editAssetScreen}>
        <AppBar title={t('library.editAsset.title')} back={back} />
        <LoadingState label={t('loading.startingUp')} />
      </Screen>
    );
  }

  if (media.isError || !media.data) {
    return (
      <Screen hasAppBar testID={testIds.library.editAssetScreen}>
        <AppBar title={t('library.editAsset.title')} back={back} />
        <ErrorState
          title={t('library.detail.notFound.title')}
          effect={t('library.detail.notFound.effect')}
          recoveryAction={back}
        />
      </Screen>
    );
  }

  return <EditMediaAssetForm media={media.data} onDone={() => navigation.goBack()} />;
}

interface EditMediaAssetFormProps {
  readonly media: MediaDetail;
  readonly onDone: () => void;
}

function EditMediaAssetForm({media, onDone}: EditMediaAssetFormProps) {
  const t = useTranslation();
  const {showToast} = useToast();
  const updateMedia = useUpdateMedia();
  const [title, setTitle] = useState(media.title);
  const [notes, setNotes] = useState(media.notes ?? '');
  const thumbnail = thumbnailImageSource(media.thumbnailToken);
  const titleError =
    title.trim().length === 0 ? t('library.detail.renameValidationTitleRequired') : undefined;

  const save = () => {
    if (titleError) {
      return;
    }
    updateMedia.mutate(
      {id: media.id, title: title.trim(), notes: notes.trim()},
      {
        onSuccess: () => {
          showToast({message: t('library.editAsset.saveSuccess'), tone: 'success'});
          onDone();
        },
      },
    );
  };

  return (
    <Screen hasAppBar scrollable testID={testIds.library.editAssetScreen}>
      <AppBar
        title={t('library.editAsset.title')}
        back={{label: t('action.back'), onPress: onDone}}
        actions={[{icon: 'check', label: t('action.save'), onPress: save}]}
      />

      <Stack gap="lg" paddingVertical="md">
        {thumbnail ? (
          <Card padding="none" elevation="level1">
            <Image
              source={thumbnail}
              style={media.kind === 'video' ? styles.previewWide : styles.previewSquare}
              resizeMode="cover"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </Card>
        ) : null}

        <Stack gap="sm">
          <TextField
            label={t('library.detail.titleLabel')}
            placeholder={t('library.detail.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            required
            error={titleError}
            testID={testIds.library.editAssetTitleField}
          />
          <TextField
            label={t('library.detail.notes')}
            placeholder={t('library.detail.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Stack>

        <Button
          label={t('action.save')}
          onPress={save}
          disabled={Boolean(titleError)}
          loading={updateMedia.isPending}
          fullWidth
          testID={testIds.library.editAssetSaveButton}
        />
      </Stack>

      {updateMedia.isError ? (
        <Dialog
          visible
          title={t('error.unexpected.title')}
          body={t('error.unexpected.effect')}
          cancel={{label: t('action.close'), onPress: () => updateMedia.reset()}}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewWide: {width: '100%', aspectRatio: 16 / 9},
  previewSquare: {width: '100%', aspectRatio: 1},
});
