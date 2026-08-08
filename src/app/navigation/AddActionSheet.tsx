/**
 * MR-03 "Navigation model": "A floating action button labeled Add opens a
 * modal action sheet with Import media, Create reminder, and Create text
 * card when text assets are enabled." Text cards are not built yet (TODO.md),
 * so that third row is correctly omitted rather than wired to a dead screen —
 * the same "omit, don't fake" rule already applied to Today's empty state.
 */
import {Icon, ListRow, Sheet} from '../../design-system';
import {useTranslation} from '../../localization';

export interface AddActionSheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly onImportMedia: () => void;
  readonly onCreateReminder: () => void;
}

export function AddActionSheet({
  visible,
  onDismiss,
  onImportMedia,
  onCreateReminder,
}: AddActionSheetProps) {
  const t = useTranslation();

  return (
    <Sheet visible={visible} onDismiss={onDismiss} title={t('add.sheetTitle')} closeLabel={t('action.close')}>
      <ListRow
        title={t('today.empty.importMedia')}
        subtitle={t('add.importMediaSubtitle')}
        leading={<Icon name="library" />}
        onPress={onImportMedia}
      />
      <ListRow
        title={t('add.createReminder')}
        subtitle={t('add.createReminderSubtitle')}
        leading={<Icon name="reminders" />}
        onPress={onCreateReminder}
      />
    </Sheet>
  );
}
