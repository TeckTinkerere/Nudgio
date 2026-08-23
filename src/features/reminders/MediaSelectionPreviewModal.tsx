/**
 * Full-screen preview shown when picking media for a reminder (spec:
 * "browse assets visually through thumbnails and preview or play all
 * supported media types before making a selection... clicking an asset
 * should open a preview player rather than taking the user to the media
 * editing page"). Video/audio delegate straight to the existing
 * `MediaPreviewPlayer` (given a `footer` slot for the persistent "Use this"
 * button); image and text get their own lightweight black-chrome modal here,
 * since neither needs `MediaPreviewPlayer`'s playback loading/error state
 * machine — a full-resolution `<Image>` is either there or it isn't.
 */
import {useState} from 'react';
import {Image, Modal, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Button, Icon, Text, neutral, useTheme} from '../../design-system';
import {mediaPlaybackSource} from '../../native-client/mediaTokens';
import type {MediaSummary, UUID} from '../../native-client/types';
import {MediaPreviewPlayer} from '../library/MediaPreviewPlayer';
import {MediaViewerHeader, mediaViewerStyles} from '../library/MediaViewerChrome';

export interface MediaSelectionPreviewModalProps {
  readonly item: MediaSummary | null;
  readonly onDismiss: () => void;
  readonly onSelect: (id: UUID) => void;
  readonly closeLabel: string;
  readonly selectLabel: string;
  readonly loadErrorLabel: string;
}

export function MediaSelectionPreviewModal({
  item,
  onDismiss,
  onSelect,
  closeLabel,
  selectLabel,
  loadErrorLabel,
}: MediaSelectionPreviewModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);

  if (!item) {
    return null;
  }

  const confirmButton = <Button label={selectLabel} onPress={() => onSelect(item.id)} fullWidth />;

  if (item.kind === 'video' || item.kind === 'audio') {
    return (
      <MediaPreviewPlayer
        visible
        onDismiss={onDismiss}
        title={item.title}
        sourceToken={item.sourceToken}
        kind={item.kind}
        closeLabel={closeLabel}
        loadErrorLabel={loadErrorLabel}
        footer={confirmButton}
      />
    );
  }

  const chromeStyles = mediaViewerStyles(theme, insets);
  const styles = StyleSheet.create({
    body: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, gap: theme.spacing.sm},
    fallbackLabel: {color: neutral.white},
    image: {width: '100%', height: '100%'},
  });

  const showImage = item.kind === 'image' && !imageFailed;

  return (
    <Modal
      visible
      transparent
      onRequestClose={onDismiss}
      animationType={theme.a11y.reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent>
      <View style={chromeStyles.root}>
        <MediaViewerHeader title={item.title} closeLabel={closeLabel} onDismiss={onDismiss} styles={chromeStyles} />

        <View style={styles.body}>
          {showImage ? (
            <Image
              source={mediaPlaybackSource(item.sourceToken)}
              style={styles.image}
              resizeMode="contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <>
              <Icon name={item.kind === 'image' ? 'mediaMissing' : 'text'} size="xl" color={neutral.white} />
              {item.kind === 'image' ? (
                <Text variant="bodyMedium" align="center" style={styles.fallbackLabel}>
                  {loadErrorLabel}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={chromeStyles.footer}>{confirmButton}</View>
      </View>
    </Modal>
  );
}
