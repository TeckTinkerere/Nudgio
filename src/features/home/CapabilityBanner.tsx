/**
 * The one high-salience capability card on Home (MR-03). It never blocks
 * browsing, and at most one shows at a time.
 *
 * Two conditions, deliberately ranked rather than merged:
 *
 *  - **Notifications off** wins, is named explicitly, and shows even with no
 *    reminders yet. This is where a user lands straight after declining the
 *    onboarding primer, so it is the first chance to explain what that
 *    decision costs. The old banner reported "exact timing is off" for every
 *    `needs_action` rollup, which pointed at the wrong thing for the one
 *    permission a user can actually decline, and it stayed hidden until a
 *    reminder existed — i.e. the explanation arrived after the decision it
 *    explains.
 *  - **Exact timing** keeps the original rule: it only matters once
 *    something is scheduled, so it waits for the first reminder. On Android
 *    13+ it is granted at install (`USE_EXACT_ALARM`), so in practice this
 *    branch is now reachable only on API 31-32.
 *
 * Both actions go where the fix is. Notifications deep-link to the system
 * notification settings rather than the in-app Health screen: the user
 * already knows what is wrong, so a summary screen in between is a step, not
 * a help.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {Banner} from '../../design-system';
import {useOpenCapabilitySettings} from '../../hooks';
import {useTranslation} from '../../localization';
import type {CapabilitySnapshot} from '../../native-client/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export interface CapabilityBannerProps {
  readonly capability: CapabilitySnapshot;
  readonly hasAnyReminder: boolean;
}

export function CapabilityBanner({capability, hasAnyReminder}: CapabilityBannerProps) {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const openCapabilitySettings = useOpenCapabilitySettings();

  const notificationsBlocked = capability.items.some(
    item => item.kind === 'notifications' && item.status !== 'ready',
  );

  if (notificationsBlocked) {
    return (
      <Banner
        testID={testIds.today.capabilityBanner}
        kind="actionNeeded"
        title={t('today.capability.notificationsOff.title')}
        effect={t('today.capability.notificationsOff.effect')}
        action={{
          label: t('today.capability.openSettings'),
          onPress: () => openCapabilitySettings.mutate('notifications'),
        }}
      />
    );
  }

  if (capability.overall === 'needs_action' && hasAnyReminder) {
    return (
      <Banner
        testID={testIds.today.capabilityBanner}
        kind="actionNeeded"
        title={t('today.capability.exactTimingOff.title')}
        effect={t('today.capability.exactTimingOff.effect')}
        action={{
          label: t('today.capability.openHealth'),
          onPress: () => navigation.navigate(rootRoutes.health),
        }}
      />
    );
  }

  return null;
}
