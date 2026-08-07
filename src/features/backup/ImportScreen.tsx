/**
 * Import / restore screen (MR-03 "Backup UX" — Import).
 *
 * "1. Choose ZIP... 2. Inspecting backup with cancel. 3. Preview version,
 * export date, counts, size, checksum status and incompatibilities.
 * 4. Choose Inspect only, Merge or Replace. 5. Review conflict plan.
 * 6. Confirm. Replace requires typing REPLACE... 7. Commit, then show
 * restored counts."
 *
 * The native `inspectBackup`/`commitImport` engine is real
 * (docs/decision-log.md DL-025 onward) — `MediaReminderClient`/`BackupRepository`
 * already expose it. What is still simulated here, against
 * `mockBackupInspection`, is step 1: this app has no document-picker
 * wired yet to turn a user's file choice into the `content://`/`file://`
 * URI `inspectBackup` needs, so there is no real archive path to inspect
 * from this screen today. `BackupScreen`'s export flow has no such
 * blocker and is wired for real. The preview step is its own component
 * (`ImportPreview`) — folding it into this file's phase switch pushed
 * the whole screen's cognitive complexity well past a readable size.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useEffect, useState} from 'react';

import {ImportPreview, type ImportMode} from './ImportPreview';
import type {RootStackParamList} from '../../app/navigation/types';
import {AppBar, Button, Dialog, ProgressBar, Screen, Stack, Text, TextField} from '../../design-system';
import {useHaptics} from '../../hooks';
import {useTranslation} from '../../localization';
import {mockBackupInspection} from '../../mocks/fixtures';


type Props = NativeStackScreenProps<RootStackParamList, 'Import'>;

type ImportPhase = 'idle' | 'inspecting' | 'preview' | 'committing' | 'done';

export function ImportScreen({navigation}: Props) {
  const t = useTranslation();
  const haptics = useHaptics();
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState('');

  useEffect(() => {
    if (phase !== 'inspecting' && phase !== 'committing') {
      return;
    }
    const timeout = setTimeout(() => {
      setPhase(phase === 'inspecting' ? 'preview' : 'done');
    }, 900);
    return () => clearTimeout(timeout);
  }, [phase]);

  const inspection = mockBackupInspection;

  const startCommit = () => {
    if (mode === 'replace') {
      setReplaceConfirmOpen(true);
      return;
    }
    setPhase('committing');
  };

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={t('backup.import.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="lg" paddingVertical="md">
        {phase === 'idle' ? (
          <Button
            label={t('backup.import.chooseFile')}
            icon="download"
            onPress={() => setPhase('inspecting')}
            fullWidth
          />
        ) : phase === 'inspecting' ? (
          <ProgressBar label={t('backup.import.inspecting')} />
        ) : phase === 'committing' ? (
          <ProgressBar label={t('backup.import.committing')} />
        ) : phase === 'done' ? (
          <Stack gap="xs" align="center" paddingVertical="xl">
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
        ) : (
          <ImportPreview
            inspection={inspection}
            mode={mode}
            onModeChange={setMode}
            onCommit={startCommit}
          />
        )}
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
                  setPhase('committing');
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
