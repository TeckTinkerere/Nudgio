/**
 * The user's media, shown large: whole (`contain`) over a blurred copy of
 * itself, so a tall portrait video and a wide panorama both fill the frame
 * without cropping or leaving it half empty. Used wherever a reminder's
 * media is the point of the screen (editor, reminder detail).
 */
import {Image, StyleSheet, View} from 'react-native';

import {Icon, useTheme, type IconName} from '../../design-system';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, ThumbnailToken} from '../../native-client/types';

const KIND_ICON: Record<MediaKind, IconName> = {video: 'video', audio: 'audio', image: 'image', text: 'text'};

export interface MediaHeroProps {
  readonly thumbnailToken: ThumbnailToken | undefined;
  readonly kind: MediaKind;
  readonly height?: number;
  /** Rounds only the top corners, for a hero that sits at the top of a card. */
  readonly roundTopOnly?: boolean;
  /** Overlaid controls, e.g. a Preview button. */
  readonly children?: React.ReactNode;
}

export function MediaHero({thumbnailToken, kind, height = 220, roundTopOnly = false, children}: MediaHeroProps) {
  const theme = useTheme();
  const thumbnail = thumbnailImageSource(thumbnailToken);
  const radius = theme.radius.card;
  const bottomRadius = roundTopOnly ? 0 : radius;
  const frame = StyleSheet.create({
    box: {
      height,
      backgroundColor: theme.color.surfaceContainerHigh,
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      borderBottomLeftRadius: bottomRadius,
      borderBottomRightRadius: bottomRadius,
    },
  });

  return (
    <View style={[styles.hero, frame.box]}>
      <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {thumbnail ? (
          <>
            <Image source={thumbnail} style={[StyleSheet.absoluteFill, styles.backdrop]} resizeMode="cover" blurRadius={20} />
            <Image source={thumbnail} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityIgnoresInvertColors />
          </>
        ) : (
          <View style={styles.center}>
            <Icon name={KIND_ICON[kind]} size="xl" color={theme.color.onSurfaceVariant} />
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {width: '100%', overflow: 'hidden'},
  backdrop: {opacity: 0.6},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
