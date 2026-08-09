/**
 * Import / restore screen (MR-03 "Backup UX" — Import).
 *
 * "1. Choose ZIP... 2. Inspecting backup with cancel. 3. Preview version,
 * export date, counts, size, checksum status and incompatibilities.
 * 4. Choose Inspect only, Merge or Replace. 5. Review conflict plan.
 * 6. Confirm. Replace requires typing REPLACE... 7. Commit, then show
 * restored counts."
 *
 * Fully real now: `pickDocument` (built for media import, generic SAF/Photo
 * Picker launch) supplies the `content://` `uriToken` `inspectBackup` needs,
 * closing the one gap that used to force step 1 through `mockBackupInspection`
 * (docs/decision-log.md — `BackupScreen`'s export side had no such blocker
 * and was already wired for real). The preview step is its own component
 * (`ImportPreview`) — folding it into this file's phase switch pushed
 * the whole screen's cognitive complexity well past a readable size.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {StyleSheet} from 'react-native';

import {ImportPreview, type ImportMode} from './ImportPreview';
import {useAppContainer} from '../../app/di/useAppContainer';
import type {RootStackParamList} from '../../app/navigation/types';
import {
  AppBar,
  Banner,
  Button,
  Dialog,
  Icon,
  ProgressBar,
  Screen,
  Stack,
  Text,
  TextField,
  useTheme,
} from '../../design-system';
import {useHaptics} from '../../hooks';
import {useTranslation} from '../../localization';
import type {BackupInspection} from '../../native-client/types';


type Props = NativeStackScreenProps<RootStackParamList, 'Import'>;

type ImportPhase = 'idle' | 'inspecting' | 'preview' | 'committing' | 'done';

/** Same tonal-circle treatment `BackupScreen`'s success state uses, for a consistent restore/export pair. */
function HeroCircle({icon, tone}: {readonly icon: 'download' | 'check'; readonly tone: 'neutral' | 'success'}) {
  const theme = useTheme();
  const styles = StyleSheet.create({
    circle: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.full,
      backgroundColor: tone === 'success' ? theme.color.successContainer : theme.color.secondaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  return (
    <Stack style={styles.circle} align="center" justify="center">
      <Icon
        name={icon}
        size="lg"
        color={tone === 'success' ? theme.color.onSuccessContainer : theme.color.onSecondaryContainer}
      />
    </Stack>
  );
}

export function ImportScreen({navigation}: Props) {
  const t = useTranslation();
  const haptics = useHaptics();
  const container = useAppContainer();
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [error, setError] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState('');

  const chooseFile = async () => {
    setError(false);
    const picked = await container.repositories.media.pickDocument(['application/zip']);
    // `ok(null)` is the user backing out of the picker — not an error, and
    // not distinguishable from "no file chosen yet", so just stay on idle.
    if (!picked.ok || picked.value === null) {
      if (!picked.ok) {setError(true);}
      return;
    }

    setPhase('inspecting');
    const inspected = await container.repositories.backup.inspectBackup(picked.value.uriToken);
    if (inspected.ok) {
      setInspection(inspected.value);
      setPhase('preview');
    } else {
      container.logger.warn('importScreen.inspectFailed', {code: inspected.error.code});
      setError(true);
      setPhase('idle');
    }
  };

  const commit = async (commitMode: ImportMode) => {
    if (!inspection) {return;}
    setPhase('committing');
    const outcome = await container.repositories.backup.commitImport({
      operationId: inspection.operationId,
      importToken: inspection.importToken,
      mode: commitMode,
    });
    if (outcome.ok) {
      setPhase('done');
    } else {
      container.logger.warn('importScreen.commitFailed', {code: outcome.error.code});
      setError(true);
      setPhase('preview');
    }
  };

  const startCommit = () => {
    if (mode === 'replace') {
      setReplaceConfirmOpen(true);
      return;
    }
    // eslint-disable-next-line no-void
    void commit(mode);
  };

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={t('backup.import.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="lg" paddingVertical="md">
        {phase === 'idle' ? (
          <Stack gap="lg" align="center" paddingVertical="xl">
            {error ? (
              <Banner
                kind="actionNeeded"
                title={t('error.unexpected.title')}
                effect={t('error.unexpected.effect')}
              />
            ) : null}
            <HeroCircle icon="download" tone="neutral" />
            <Button
              label={t('backup.import.chooseFile')}
              icon="download"
              onPress={() => {
                // eslint-disable-next-line no-void
                void chooseFile();
              }}
              fullWidth
            />
          </Stack>
        ) : phase === 'inspecting' ? (
          <ProgressBar label={t('backup.import.inspecting')} />
        ) : phase === 'committing' ? (
          <ProgressBar label={t('backup.import.committing')} />
        ) : phase === 'done' && inspection ? (
          <Stack gap="sm" align="center" paddingVertical="xl">
            <HeroCircle icon="check" tone="success" />
            <Text variant="headlineMedium" isHeading align="center">
              {t('backup.import.successTitle')}
            </Text>
            <Text variant="bodyLarge" tone="variant" align="center">
              {t('backup.import.successBody', {
                mediaCount: inspection.mediaCount,
                reminderCount: inspection.reminderCount,
              })}
            </Text>
            <Button label={t('backup.export.done')} onPress={() => navigation.goBack()} />
          </Stack>
        ) : inspection ? (
          <ImportPreview
            inspection={inspection}
            mode={mode}
            onModeChange={setMode}
            onCommit={startCommit}
          />
        ) : null}
      </Stack>

      <Dialog
        visible={replaceConfirmOpen}
        destructive
        title={t('backup.import.replaceConfirmTitle')}
        body={t('backup.import.replaceConfirmBody')}
        cancel={{
          label: t('action.cancel'),
          onPress: () => {
            setReplaceConfirmOpen(false);
            setReplaceConfirmText('');
          },
        }}
        // The confirm button only exists once the typed token matches — a
        // silently-ignored tap on a permanently-enabled button would be a
        // confusing dead end for a destructive, typed confirmation (MR-13
        // cognitive accessibility).
        confirm={
          replaceConfirmText.trim().toUpperCase() === t('backup.import.replaceConfirmToken')
            ? {
                label: t('backup.import.replace'),
                onPress: () => {
                  haptics.trigger('warning');
                  setReplaceConfirmOpen(false);
                  setReplaceConfirmText('');
                  // eslint-disable-next-line no-void
                  void commit('replace');
                },
              }
            : undefined
        }>
        <TextField
          label={t('backup.import.replaceConfirmToken')}
          value={replaceConfirmText}
          onChangeText={setReplaceConfirmText}
        />
      </Dialog>
    </Screen>
  );
}
