/**
 * Editor section "After the reminder" (DL-080): nothing, or open a link.
 *
 * The link field accepts what people actually paste — a full URL, a bare
 * `youtube.com/…`, a phone number, an email address — and shows what it
 * resolved to ("Opens YouTube") as they type, so a typo is visible before
 * the reminder fires rather than at 8 PM. "Try it" opens the link right
 * now through the same launcher the moment screen uses.
 */
import {StyleSheet, View} from 'react-native';

import {EditorSectionHeading} from './EditorSectionHeading';
import {Button, Chip, Icon, Stack, Text, TextField, useTheme} from '../../../design-system';
import {useTranslation} from '../../../localization';
import type {ReminderActionDto} from '../../../native-client/types';
import {
  ACTION_TARGET_ICON,
  ACTION_TARGET_LABEL_KEY,
  MAX_ACTION_LABEL_LENGTH,
  MAX_ACTION_URI_LENGTH,
  actionTargetOf,
  displayHostOf,
  isAllowedActionUri,
  normalizeActionUri,
} from '../reminderActions';
import {useOpenReminderAction} from '../useOpenReminderAction';

export interface ActionDraft {
  readonly enabled: boolean;
  /** Raw text as typed; normalized only when read (`actionFromDraft`). */
  readonly link: string;
  readonly label: string;
}

export const draftFromAction = (action: ReminderActionDto | null | undefined): ActionDraft => ({
  enabled: action !== null && action !== undefined,
  link: action?.uri ?? '',
  label: action?.label ?? '',
});

/** `null` = no action; `'invalid'` = the user asked for a link that can't be opened. */
export const actionFromDraft = (draft: ActionDraft): ReminderActionDto | null | 'invalid' => {
  if (!draft.enabled) {
    return null;
  }
  const uri = normalizeActionUri(draft.link);
  if (!isAllowedActionUri(uri)) {
    return 'invalid';
  }
  const label = draft.label.trim();
  return {type: 'open_link', uri, label: label.length > 0 ? label : null};
};

export interface ReminderActionSectionProps {
  readonly value: ActionDraft;
  readonly onChange: (next: ActionDraft) => void;
  /** True once the link field was left or Save was attempted — errors never appear mid-typing. */
  readonly showErrors: boolean;
  readonly onLinkBlur: () => void;
}

export function ReminderActionSection({value, onChange, showErrors, onLinkBlur}: ReminderActionSectionProps) {
  const t = useTranslation();
  const theme = useTheme();
  const openAction = useOpenReminderAction();

  const resolved = actionFromDraft(value);
  const uri = normalizeActionUri(value.link);
  const valid = resolved !== 'invalid' && resolved !== null;
  const target = valid ? actionTargetOf(uri) : null;
  const host = valid ? displayHostOf(uri) : null;
  const linkError = value.enabled && showErrors && !valid ? t('reminders.action.invalid') : undefined;

  return (
    <Stack gap="sm">
      <Stack gap="xxs">
        <EditorSectionHeading label={t('reminders.action.section')} />
        <Text variant="bodyMedium" tone="variant">{t('reminders.action.sectionHelper')}</Text>
      </Stack>
      <Stack direction="row" gap="xxs" wrap accessibilityLabel={t('reminders.action.section')}>
        <Chip label={t('reminders.action.none')} selected={!value.enabled}
          onPress={() => onChange({...value, enabled: false})} />
        <Chip label={t('reminders.action.openLink')} selected={value.enabled}
          onPress={() => onChange({...value, enabled: true})} />
      </Stack>

      {value.enabled ? (
        <Stack gap="sm">
          <TextField
            label={t('reminders.action.linkLabel')}
            placeholder={t('reminders.action.linkPlaceholder')}
            value={value.link}
            onChangeText={link => onChange({...value, link})}
            onBlur={onLinkBlur}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_ACTION_URI_LENGTH}
            error={linkError}
            testID="reminder-action-link"
          />
          {target ? (
            <View style={[styles.resolved, {gap: theme.spacing.xs}]}>
              <Icon name={ACTION_TARGET_ICON[target]} size="sm" color={theme.color.primary} />
              <Text variant="bodyMedium" tone="variant" style={styles.flex} numberOfLines={1}>
                {host && target === 'web' ? t('reminders.action.opensHost', {host}) : t(ACTION_TARGET_LABEL_KEY[target])}
              </Text>
              <Button
                label={t('reminders.action.test')}
                variant="text"
                icon="openExternal"
                onPress={() => {
                  if (resolved !== null && resolved !== 'invalid') {
                    // eslint-disable-next-line no-void
                    void openAction(resolved);
                  }
                }}
              />
            </View>
          ) : null}
          <TextField
            label={t('reminders.action.buttonLabel')}
            placeholder={target ? t(ACTION_TARGET_LABEL_KEY[target]) : t('reminders.action.default.web')}
            value={value.label}
            onChangeText={label => onChange({...value, label})}
            maxLength={MAX_ACTION_LABEL_LENGTH}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  resolved: {flexDirection: 'row', alignItems: 'center'},
  flex: {flex: 1},
});
