/**
 * Full-screen in-place preview playback (user request: "preview play in the
 * library"), opened from the Library grid and from Media Detail's "Play
 * preview" button — the same overlay either way, since both just need to
 * play one media item without leaving the screen that opened it.
 *
 * Always black/white regardless of app theme, the same reasoning `MediaCard`'s
 * scrim already documents: this is an immersive media surface, not a themed
 * dialog, and must stay legible over arbitrary video content in any theme.
 *
 * `controls` delegates the actual transport UI (play/pause, scrubber) to the
 * platform player (ExoPlayer's own controller on Android) rather than a
 * hand-built scrubber — the close button and loading/error framing around it
 * are this component's own.
 */
import {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReactVideo from 'react-native-video';

import {IconButton} from '../../design-system/components/IconButton';
import {Text} from '../../design-system/components/Text';
import {Icon} from '../../design-system/icons';
import {useTheme} from '../../design-system/theme/useTheme';
import {neutral} from '../../design-system/tokens';
import {mediaPlaybackSource} from '../../native-client/mediaTokens';
import type {MediaSourceToken} from '../../native-client/types';

export interface MediaPreviewPlayerProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly title: string;
  readonly sourceToken: MediaSourceToken;
  /** Only video/audio are ever playable — callers gate on `kind` before opening this. */
  readonly kind: 'video' | 'audio';
  readonly closeLabel: string;
  readonly loadErrorLabel: string;
  readonly testID?: string;
}

type Status = 'loading' | 'ready' | 'error';

export function MediaPreviewPlayer({
  visible,
  onDismiss,
  title,
  sourceToken,
  kind,
  closeLabel,
  loadErrorLabel,
  testID,
}: MediaPreviewPlayerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>('loading');

  // A fresh open (possibly of a different item) always starts from
  // "loading" — without this, re-opening after a previous item errored
  // would show the stale error state for a split second before playback
  // events for the new source arrive.
  useEffect(() => {
    if (visible) {
      setStatus('loading');
    }
  }, [visible, sourceToken]);

  // Wrapped in `StyleSheet.create` (recomputed each render, cheap) rather
  // than raw inline objects: this screen's insets/theme values are
  // genuinely per-render dynamic, unlike the rest of `features/**`, which
  // leans on design-system components' own spacing-token props instead of
  // ever needing a raw inline style.
  const styles = StyleSheet.create({
    root: {flex: 1, backgroundColor: neutral.black},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: insets.top + theme.spacing.xxs,
      paddingStart: theme.layout.dialogPadding,
      paddingEnd: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
    },
    title: {flex: 1, color: neutral.white},
    body: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: insets.bottom},
    errorContent: {alignItems: 'center', gap: theme.spacing.xs, padding: theme.layout.dialogPadding},
    errorLabel: {color: neutral.white},
    video: {width: '100%', height: kind === 'video' ? '100%' : 160},
    spinner: {position: 'absolute'},
  });

  return (
    <Modal
      visible={visible}
      transparent
      onRequestClose={onDismiss}
      animationType={theme.a11y.reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent>
      <View style={styles.root} testID={testID}>
        <View style={styles.header}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <IconButton name="close" label={closeLabel} onPress={onDismiss} />
        </View>

        <View style={styles.body}>
          {status === 'error' ? (
            <View style={styles.errorContent}>
              <Icon name={kind} size="xl" color={neutral.white} />
              <Text variant="bodyMedium" align="center" style={styles.errorLabel}>
                {loadErrorLabel}
              </Text>
            </View>
          ) : (
            <ReactVideo
              source={mediaPlaybackSource(sourceToken)}
              style={styles.video}
              controls
              paused={!visible}
              resizeMode="contain"
              onLoad={() => setStatus('ready')}
              onError={() => setStatus('error')}
            />
          )}
          {status === 'loading' ? (
            <ActivityIndicator
              size="large"
              color={neutral.white}
              style={styles.spinner}
              accessibilityLabel={title}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
