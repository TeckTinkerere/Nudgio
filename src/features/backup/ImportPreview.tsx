/**
 * Backup preview + conflict plan + Inspect/Merge/Replace choice.
 *
 * Split out of `ImportScreen` purely to keep that screen's phase switch
 * readable — this is one phase's worth of UI, not a reusable component.
 */
import {Button, Card, RadioCard, Stack, StatusPill, Text} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTranslation, type TranslationKey} from '../../localization';
import type {BackupInspection, ConflictSummary, ImportMode} from '../../native-client/types';
import {formatBytes} from '../../utils';

export type {ImportMode};

const MODE_ICON = {
  inspect: 'search',
  merge: 'download',
  replace: 'delete',
} as const satisfies Record<ImportMode, IconName>;

const MODE_LABEL_KEY: Record<ImportMode, TranslationKey> = {
  inspect: 'backup.import.inspectOnly',
  merge: 'backup.import.merge',
  replace: 'backup.import.replace',
};

const MODE_DESCRIPTION_KEY: Record<ImportMode, TranslationKey> = {
  inspect: 'backup.import.inspectOnlyDescription',
  merge: 'backup.import.mergeDescription',
  replace: 'backup.import.replaceDescription',
};

const IMPORT_MODES: readonly ImportMode[] = ['inspect', 'merge', 'replace'];

export interface ImportPreviewProps {
  readonly inspection: BackupInspection;
  readonly mode: ImportMode;
  readonly onModeChange: (mode: ImportMode) => void;
  readonly onCommit: () => void;
}

const CONFLICT_LABEL_KEY: Record<ConflictSummary['kind'], TranslationKey> = {
  media: 'backup.conflict.media',
  reminder: 'backup.conflict.reminder',
  profile: 'backup.conflict.profile',
  category: 'backup.conflict.category',
  tag: 'backup.conflict.tag',
};

const COMPATIBILITY_LABEL_KEY: Record<BackupInspection['compatibility'], TranslationKey> = {
  compatible: 'backup.import.compatibilityCompatible',
  migratable: 'backup.import.compatibilityMigratable',
  too_new: 'backup.import.compatibilityTooNew',
  unsupported: 'backup.import.compatibilityUnsupported',
};

function SummaryRow({label, value}: {readonly label: string; readonly value: string | number}) {
  return (
    <Stack direction="row" justify="space-between">
      <Text variant="bodyLarge" tone="variant">
        {label}
      </Text>
      <Text variant="bodyLarge" tabularNumbers>
        {value}
      </Text>
    </Stack>
  );
}

export function ImportPreview({inspection, mode, onModeChange, onCommit}: ImportPreviewProps) {
  const t = useTranslation();

  return (
    <>
      <Card>
        <Stack gap="xs">
          <SummaryRow
            label={t('backup.import.previewCreatedAt')}
            value={new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'}).format(
              new Date(inspection.createdAt),
            )}
          />
          <Text variant="bodyMedium" tone="variant">
            {t('backup.import.previewSourceVersion', {version: inspection.sourceAppVersion})}
          </Text>
          <SummaryRow label={t('backup.export.mediaCount')} value={inspection.mediaCount} />
          <SummaryRow label={t('backup.export.reminderCount')} value={inspection.reminderCount} />
          <SummaryRow
            label={t('backup.import.previewSize')}
            value={formatBytes(inspection.compressedBytes)}
          />
          <StatusPill
            kind={inspection.checksumStatus === 'valid' ? 'ready' : 'actionNeeded'}
            label={
              inspection.checksumStatus === 'valid'
                ? t('backup.import.checksumValid')
                : t('backup.import.checksumInvalid')
            }
          />
          <StatusPill
            kind={inspection.compatibility === 'compatible' ? 'ready' : 'limited'}
            label={t(COMPATIBILITY_LABEL_KEY[inspection.compatibility])}
          />
        </Stack>
      </Card>

      {inspection.conflicts.length > 0 ? (
        <Stack gap="xxs">
          <Text variant="titleMedium">{t('backup.import.conflictsTitle')}</Text>
          {inspection.conflicts.map(conflict => (
            <Text key={conflict.kind} variant="bodyMedium" tone="variant">
              {t(CONFLICT_LABEL_KEY[conflict.kind], {count: conflict.count})} —{' '}
              {t(conflict.resolutionKey as TranslationKey)}
            </Text>
          ))}
        </Stack>
      ) : null}

      <Stack gap="xs">
        <Text variant="titleMedium">{t('backup.import.title')}</Text>
        {IMPORT_MODES.map(candidate => (
          <RadioCard
            key={candidate}
            title={t(MODE_LABEL_KEY[candidate])}
            description={t(MODE_DESCRIPTION_KEY[candidate])}
            icon={MODE_ICON[candidate]}
            selected={mode === candidate}
            onPress={() => onModeChange(candidate)}
            notice={candidate === 'replace' ? t('backup.import.replaceNotice') : undefined}
          />
        ))}
      </Stack>

      <Button
        label={mode === 'inspect' ? t('action.details') : t('backup.import.title')}
        onPress={onCommit}
        fullWidth
      />
    </>
  );
}
