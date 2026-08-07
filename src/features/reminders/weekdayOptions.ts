import type {WeekdayOption} from '../../design-system';
import type {Translate} from '../../localization';

/**
 * ISO weekday order (Monday = 1 ... Sunday = 7), matching MR-13's "store ISO,
 * display local" rule. V1 ships English only, so this is a fixed Monday-first
 * row rather than a fully locale-aware reordering — the seam is here, one
 * function, when a second locale needs a different first day.
 */
export const weekdayOptions = (t: Translate): readonly WeekdayOption[] => [
  {isoWeekday: 1, label: t('reminders.weekday.mon'), accessibleLabel: t('reminders.weekday.monday')},
  {isoWeekday: 2, label: t('reminders.weekday.tue'), accessibleLabel: t('reminders.weekday.tuesday')},
  {isoWeekday: 3, label: t('reminders.weekday.wed'), accessibleLabel: t('reminders.weekday.wednesday')},
  {isoWeekday: 4, label: t('reminders.weekday.thu'), accessibleLabel: t('reminders.weekday.thursday')},
  {isoWeekday: 5, label: t('reminders.weekday.fri'), accessibleLabel: t('reminders.weekday.friday')},
  {isoWeekday: 6, label: t('reminders.weekday.sat'), accessibleLabel: t('reminders.weekday.saturday')},
  {isoWeekday: 7, label: t('reminders.weekday.sun'), accessibleLabel: t('reminders.weekday.sunday')},
];
