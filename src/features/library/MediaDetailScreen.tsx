/**
 * Media detail screen (MR-03 "Media detail") — the standalone pushed-screen
 * host for `MediaDetailContent`. `LibraryScreen`'s two-pane layout renders
 * the same content component embedded, without this wrapper.
 *
 * Data source: real, Room-backed (`useMediaDetail`/`getMedia`) — a previous
 * revision used `findMockMedia`, which could never resolve a real imported
 * item's UUID, so opening this screen from a real Library grid always showed
 * "not found." "Attached reminders" filters the real reminder list client-
 * side by `mediaId`; MR-09 does not anticipate enough reminders per medium to
 * need a dedicated indexed query for this.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {MediaDetailContent} from './MediaDetailContent';
import type {RootStackParamList} from '../../app/navigation/types';
import {Screen} from '../../design-system';

type Props = NativeStackScreenProps<RootStackParamList, 'MediaDetail'>;

export function MediaDetailScreen({navigation, route}: Props) {
  return (
    <Screen hasAppBar scrollable>
      <MediaDetailContent mediaId={route.params.mediaId} onBack={() => navigation.goBack()} />
    </Screen>
  );
}
