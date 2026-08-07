/**
 * Navigation param lists.
 *
 * Typed per the React Navigation convention so `navigation.navigate(...)` and
 * `route.params` are checked at compile time. `undefined` params are still
 * declared explicitly (not omitted) so a screen's signature is self-documenting.
 */
import type {NavigatorScreenParams} from '@react-navigation/native';

import type {rootRoutes, tabRoutes} from '../../constants/routes';
import type {UUID} from '../../native-client/types';

export type TabParamList = {
  [tabRoutes.today]: undefined;
  [tabRoutes.library]: undefined;
  [tabRoutes.reminders]: undefined;
  [tabRoutes.settings]: undefined;
};

export type RootStackParamList = {
  [rootRoutes.onboarding]: undefined;
  [rootRoutes.tabs]: NavigatorScreenParams<TabParamList> | undefined;
  [rootRoutes.mediaDetail]: {readonly mediaId: UUID};
  [rootRoutes.reminderDetail]: {readonly reminderId: UUID};
  [rootRoutes.reminderEditor]: {readonly reminderId: UUID | undefined};
  [rootRoutes.health]: undefined;
  [rootRoutes.backup]: undefined;
  [rootRoutes.import]: undefined;
  [rootRoutes.statistics]: undefined;
  [rootRoutes.about]: undefined;
};

declare global {
   
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
