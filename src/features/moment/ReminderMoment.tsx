/**
 * The moment (DL-080): what opens when a reminder is played — from the
 * full-screen alarm, the notification, or the in-app strip.
 *
 * This is the product's payoff screen, so it is built around the user's own
 * media rather than around reminder metadata: the media fills the top of the
 * screen (an image large with a soft blurred fill behind it, a video playing
 * because the user just pressed Play, an audio clip with its artwork and
 * controls), and below it the reminder's title, their message, and what to
 * do next — their configured action ("Start lesson") with Done beside it,
 * or just Done.
 *
 * It is a shell-level `Modal`, not a navigation route, for the same reason
 * the viewer it replaces was: the app may have cold-started from the lock
 * screen with no particular screen mounted, and a Modal needs nothing else
 * to be ready. Android's back gesture closes it (`onRequestClose`).
 *
 * Missing or unreadable media never blocks the moment: the words and the
 * action still show, with a plain explanation where the media would be.
 */
import {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReactVideo, {type VideoRef} from 'react-native-video';

import {useSessionStore} from '../../core/state/sessionStore';
import {Button, Icon, Text, neutral, useTheme} from '../../design-system';
import {withAlpha} from '../../design-system/theme/colorUtils';
import {useTranslation} from '../../localization';
import {mediaPlaybackSource, thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaDetail, ReminderDetail} from '../../native-client/types';
import {useMediaDetail} from '../library/useMediaDetail';
import {actionButtonLabel, actionTargetOf, ACTION_TARGET_ICON} from '../reminders/reminderActions';
import {useOpenReminderAction} from '../reminders/useOpenReminderAction';
import {useReminderDetail} from '../reminders/useReminderDetail';

/** The moment is a glance; the detail screen holds the full text. */
const TITLE_MAX_LINES = 3;
const MESSAGE_MAX_LINES = 4;

/** Wide enough to put media and words side by side (landscape phones, tablets). */
const SIDE_BY_SIDE_MIN_WIDTH = 600;

export function ReminderMoment() {
  const moment = useSessionStore(state => state.moment);
  const closeMoment = useSessionStore(state => state.closeMoment);
  if (!moment) {
    return null;
  }
  // Keyed so a second Play while one moment is open starts fresh state.
  return (
    <MomentContent
      key={`${moment.reminderId ?? ''}:${moment.mediaId ?? ''}`}
      reminderId={moment.reminderId ?? undefined}
      fallbackMediaId={moment.mediaId ?? undefined}
      onClose={closeMoment}
    />
  );
}

interface MomentContentProps {
  readonly reminderId: ReminderDetail['id'] | undefined;
  readonly fallbackMediaId: MediaDetail['id'] | undefined;
  readonly onClose: () => void;
}

function MomentContent({reminderId, fallbackMediaId, onClose}: MomentContentProps) {
  const theme = useTheme();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const openAction = useOpenReminderAction();

  const reminder = useReminderDetail(reminderId);
  const mediaId = reminder.data?.mediaId ?? fallbackMediaId;
  const media = useMediaDetail(mediaId);

  const sideBySide = width >= SIDE_BY_SIDE_MIN_WIDTH && width > height;
  const loading = (reminderId !== undefined && reminder.isPending) || (mediaId !== undefined && media.isPending);

  const action = reminder.data?.action ?? null;
  const title = reminder.data?.label ?? media.data?.title ?? '';
  const message = reminder.data?.notes?.trim();

  const styles = StyleSheet.create({
    root: {flex: 1, backgroundColor: neutral.black, flexDirection: sideBySide ? 'row' : 'column'},
    stage: {flex: 1, overflow: 'hidden'},
    close: {
      position: 'absolute',
      top: insets.top + theme.spacing.xs,
      start: (sideBySide ? insets.left : 0) + theme.spacing.xs,
      width: theme.layout.minTouchTarget,
      height: theme.layout.minTouchTarget,
      borderRadius: theme.radius.full,
      backgroundColor: withAlpha(neutral.black, 0.45),
      alignItems: 'center',
      justifyContent: 'center',
    },
    panel: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: sideBySide ? 0 : theme.radius.sheet,
      borderTopRightRadius: sideBySide ? 0 : theme.radius.sheet,
      width: sideBySide ? Math.min(420, width * 0.42) : undefined,
      maxHeight: sideBySide ? undefined : height * 0.55,
      paddingTop: sideBySide ? insets.top + theme.spacing.lg : theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.md,
      paddingStart: theme.spacing.lg,
      paddingEnd: (sideBySide ? insets.right : 0) + theme.spacing.lg,
      justifyContent: sideBySide ? 'center' : undefined,
    },
    words: {gap: theme.spacing.xs, paddingBottom: theme.spacing.md},
    actions: {gap: theme.spacing.sm},
  });

  return (
    <Modal
      visible
      onRequestClose={onClose}
      animationType={theme.a11y.reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent>
      <View style={styles.root} testID="reminder-moment">
        <View style={styles.stage}>
          {loading ? (
            <CenteredSpinner label={t('moment.loading')} />
          ) : (
            <MomentMedia
              media={media.data}
              unavailable={mediaId === undefined || media.isError}
              startMs={reminder.data?.mediaStartMs ?? null}
            />
          )}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('moment.close')}
            hitSlop={8}
            style={styles.close}>
            <Icon name="close" color={neutral.white} />
          </Pressable>
        </View>

        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.words} bounces={false}>
            {reminder.data?.repeatSummary ? (
              <Text variant="labelLarge" tone="variant">
                {reminder.data.repeatSummary}
              </Text>
            ) : null}
            {title ? (
              // Clamped: a 120-character title ran to six lines, pushing the
              // panel up until it covered more than half the screen and
              // squeezed the media this moment exists to show. The whole
              // title is still on the reminder's detail screen.
              <Text variant="headlineMedium" isHeading numberOfLines={TITLE_MAX_LINES}>
                {title}
              </Text>
            ) : null}
            {message ? (
              <Text variant="bodyLarge" numberOfLines={MESSAGE_MAX_LINES}>
                {message}
              </Text>
            ) : null}
          </ScrollView>

          {/*
            Stacked, not side by side. An action label is the user's own text
            (up to 40 characters), and in half the panel's width a long one
            wrapped to four lines — so the optional action became a tall blue
            slab and Done shrank to a chip beside it, inverting the hierarchy
            on the screen where it matters most. Full width each keeps every
            label on one or two lines and makes the order unambiguous, without
            truncating a label the user wrote (MR-04 forbids that).
          */}
          <View style={styles.actions}>
            {action ? (
              <>
                <Button
                  label={actionButtonLabel(action, t)}
                  icon={ACTION_TARGET_ICON[actionTargetOf(action.uri)]}
                  onPress={async () => {
                    if (await openAction(action)) {
                      onClose();
                    }
                  }}
                  fullWidth
                  testID="moment-action"
                />
                <Button label={t('moment.done')} variant="tonal" onPress={onClose} fullWidth />
              </>
            ) : (
              <Button label={t('moment.done')} onPress={onClose} fullWidth />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CenteredSpinner({label}: {readonly label: string}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={centered.fill}>
        <ActivityIndicator size="large" color={neutral.white} accessibilityLabel={label} />
      </View>
    </View>
  );
}

interface MomentMediaProps {
  readonly media: MediaDetail | undefined;
  readonly unavailable: boolean;
  /** DL-110: the reminder's chosen start point, in ms. */
  readonly startMs: number | null;
}

/**
 * One rendering per media kind. Playback failures fall through to the same
 * "not available" state as a missing row, so a moved/corrupted file reads
 * the same as a deleted one.
 */
function MomentMedia({media, unavailable, startMs}: MomentMediaProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const player = useRef<VideoRef>(null);
  const seekToStart = () => {
    if (startMs) {
      player.current?.seek(startMs / 1000);
    }
  };

  const broken =
    unavailable || failed || !media || media.integrity === 'missing' || media.integrity === 'unsupported';
  if (broken) {
    return <MediaUnavailable />;
  }

  const thumbnail = thumbnailImageSource(media.thumbnailToken);
  const source = mediaPlaybackSource(media.sourceToken);

  if (media.kind === 'image') {
    return (
      <View style={StyleSheet.absoluteFill}>
        {/* The same picture, blurred, fills the letterbox around a non-matching aspect ratio. */}
        <Image source={thumbnail ?? source} style={[StyleSheet.absoluteFill, media_.backdrop]} blurRadius={24} resizeMode="cover" />
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          accessibilityLabel={media.title}
        />
      </View>
    );
  }

  if (media.kind === 'video') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <ReactVideo
          source={source}
          style={StyleSheet.absoluteFill}
          controls
          resizeMode="contain"
          ref={player}
          onLoad={() => {
            setVideoReady(true);
            seekToStart();
          }}
          onError={() => setFailed(true)}
        />
        {!videoReady ? (
          <View style={centered.fill} pointerEvents="none">
            <ActivityIndicator size="large" color={neutral.white} />
          </View>
        ) : null}
      </View>
    );
  }

  if (media.kind === 'audio') {
    return (
      <View style={[StyleSheet.absoluteFill, centered.fill, {padding: theme.spacing.xl, gap: theme.spacing.lg}]}>
        {thumbnail ? (
          <>
            <Image source={thumbnail} style={[StyleSheet.absoluteFill, media_.backdrop]} blurRadius={24} resizeMode="cover" />
            <Image source={thumbnail} style={[media_.artwork, {borderRadius: theme.radius.card}]} resizeMode="cover" />
          </>
        ) : (
          <View style={[media_.artwork, centered.fill, {borderRadius: theme.radius.card, backgroundColor: withAlpha(neutral.white, 0.08)}]}>
            <Icon name="audio" size="xl" color={neutral.white} />
          </View>
        )}
        <ReactVideo
          source={source}
          style={media_.audioControls}
          controls
          ref={player}
          onLoad={seekToStart}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={centered.fill}>
      <Icon name="text" size="xl" color={neutral.white} />
    </View>
  );
}

function MediaUnavailable() {
  const theme = useTheme();
  const t = useTranslation();
  return (
    <View style={[centered.fill, {padding: theme.spacing.xl, gap: theme.spacing.xs}]}>
      <Icon name="mediaMissing" size="xl" color={neutral.white} />
      <Text variant="titleMedium" align="center" style={media_.onDark}>
        {t('moment.mediaMissingTitle')}
      </Text>
      <Text variant="bodyMedium" align="center" style={media_.onDarkVariant}>
        {t('moment.mediaMissingBody')}
      </Text>
    </View>
  );
}

const centered = StyleSheet.create({
  fill: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});

const media_ = StyleSheet.create({
  backdrop: {opacity: 0.55},
  artwork: {width: 200, height: 200, maxWidth: '70%', aspectRatio: 1},
  audioControls: {width: '100%', height: 72},
  onDark: {color: neutral.white},
  onDarkVariant: {color: withAlpha(neutral.white, 0.72)},
});
