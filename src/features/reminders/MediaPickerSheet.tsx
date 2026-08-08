/**
 * "Choose media" sheet for the reminder editor's What section.
 *
 * Extracted out of `ReminderEditorScreen` purely to keep that screen's own
 * branching (repeat type, profile, snooze, preview) readable — this sheet's
 * pending/empty/list states have no other reason to live in the parent.
 *
 * Plain map, not `VirtualizedList`: `Sheet`'s body is already a `ScrollView`,
 * and React Native warns (and pays a real perf cost) when a `FlatList` is
 * nested inside one. The caller's `items` page is bounded for the same
 * reason (MR-09 anticipates a large library eventually); a searchable
 * full-screen picker route is the real fix once one exceeds that, not this
 * sheet.
 */
import {Card, EmptyState, Icon, Sheet, Stack, Text} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTranslation} from '../../localization';
import type {MediaKind, MediaSummary, UUID} from '../../native-client/types';

/** Shared with `ReminderEditorScreen`'s "What" card, which shows the same icon for the already-selected item. */
export const MEDIA_KIND_ICON: Record<MediaKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

export interface MediaPickerSheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly items: readonly MediaSummary[] | undefined;
  readonly isPending: boolean;
  readonly selectedId: UUID | undefined;
  readonly onSelect: (id: UUID) => void;
}

export function MediaPickerSheet({
  visible,
  onDismiss,
  items,
  isPending,
  selectedId,
  onSelect,
}: MediaPickerSheetProps) {
  const t = useTranslation();

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      title={t('reminders.editor.chooseMedia')}
      closeLabel={t('action.close')}>
      {isPending ? (
        <Text variant="bodyMedium" tone="variant">
          {t('loading.startingUp')}
        </Text>
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon="library"
          title={t('today.empty.title')}
          body={t('reminders.editor.noMediaBody')}
        />
      ) : (
        items.map(item => (
          <Card key={item.id} onPress={() => onSelect(item.id)} selected={item.id === selectedId}>
            <Stack direction="row" align="center" gap="sm">
              <Icon name={MEDIA_KIND_ICON[item.kind]} />
              <Text variant="titleMedium">{item.title}</Text>
            </Stack>
          </Card>
        ))
      )}
    </Sheet>
  );
}
