/**
 * One album, the way a phone gallery shows it: a square cover made of what
 * is inside (the newest item large, or a 2×2 mosaic once there are four),
 * then its name and how much it holds. Tapping opens it; long-press starts
 * selection; the ⋮ button (its own 48 dp target, never part of the cover's
 * tap area) opens the album's options.
 *
 * The same tile, with `kind="new"`, is the "New album" affordance at the end
 * of the grid, and with an `icon` the virtual Unsorted album — so creating
 * and browsing look like one coherent shelf rather than a list plus buttons.
 */
import {Image, Pressable, StyleSheet, View} from 'react-native';

import type {AlbumCover} from './libraryAlbums';
import {Icon, IconButton, Text, useTheme, type IconName} from '../../design-system';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind} from '../../native-client/types';

const KIND_ICON: Record<MediaKind, IconName> = {video: 'video', audio: 'audio', image: 'image', text: 'text'};

export interface AlbumTileProps {
  readonly name: string;
  /** Already localized, e.g. "12 items · 2 albums". */
  readonly detail?: string;
  readonly covers?: readonly AlbumCover[];
  /** Shown on an empty cover (and always, for Unsorted / New album). */
  readonly icon?: IconName;
  readonly kind?: 'album' | 'new';
  readonly pinned?: boolean;
  readonly selected?: boolean;
  readonly selectionMode?: boolean;
  /** Fixed width for horizontal rows; omit to fill a grid cell. */
  readonly width?: number;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly onOptions?: () => void;
  readonly optionsLabel?: string;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function AlbumTile({
  name,
  detail,
  covers = [],
  icon = 'album',
  kind = 'album',
  pinned = false,
  selected = false,
  selectionMode = false,
  width,
  onPress,
  onLongPress,
  onOptions,
  optionsLabel,
  accessibilityLabel,
  testID,
}: AlbumTileProps) {
  const theme = useTheme();
  const isNew = kind === 'new';

  const styles = StyleSheet.create({
    root: {width, flex: width === undefined ? 1 : undefined},
    cover: {
      aspectRatio: 1,
      borderRadius: theme.radius.card,
      overflow: 'hidden',
      backgroundColor: isNew ? theme.color.surface : theme.color.surfaceContainerHigh,
      borderWidth: isNew ? theme.layout.borderWidth * 2 : selected ? 3 : 0,
      borderStyle: isNew ? 'dashed' : 'solid',
      borderColor: isNew ? theme.color.outline : theme.color.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mosaic: {flex: 1, alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 2},
    mosaicCell: {width: '49.4%', height: '49.4%', backgroundColor: theme.color.surfaceContainer, alignItems: 'center', justifyContent: 'center'},
    badge: {
      position: 'absolute',
      top: theme.spacing.xs,
      left: theme.spacing.xs,
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.full,
      padding: theme.spacing.xxs,
    },
    check: {
      position: 'absolute',
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: selected ? theme.color.primary : theme.color.surface,
      borderWidth: selected ? 0 : 2,
      borderColor: theme.color.outline,
    },
    label: {paddingTop: theme.spacing.xs, minHeight: theme.layout.minTouchTarget},
    labelBesideOptions: {paddingEnd: theme.layout.minTouchTarget},
    options: {position: 'absolute', right: -theme.spacing.xs, bottom: 0},
  });

  const cell = (cover: AlbumCover | undefined, key: string) => {
    const source = thumbnailImageSource(cover?.thumbnailToken ?? undefined);
    return (
      <View key={key} style={styles.mosaicCell}>
        {source ? (
          <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : cover ? (
          <Icon name={KIND_ICON[cover.kind]} size="sm" color={theme.color.onSurfaceVariant} />
        ) : null}
      </View>
    );
  };

  // A single cover is the newest item that has a picture — an album whose
  // latest addition is a voice note should still look like its photos.
  const newest = covers[0];
  const pictured = covers.find(cover => cover.thumbnailToken !== null);
  const newestSource = thumbnailImageSource(pictured?.thumbnailToken ?? undefined);

  const showOptions = Boolean(onOptions && optionsLabel && !selectionMode);

  // The whole tile — cover and name — opens the album; ⋮ sits on top of the
  // name row as its own 48 dp target, outside that pressable.
  return (
    <View style={styles.root} testID={testID}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selectionMode ? {selected} : undefined}
        style={({pressed}) => ({opacity: pressed ? 0.88 : 1})}>
        <View style={styles.cover}>
          {isNew || covers.length === 0 ? (
            <Icon name={isNew ? 'add' : icon} size="lg" color={isNew ? theme.color.primary : theme.color.onSurfaceVariant} />
          ) : covers.length >= 4 ? (
            <View style={styles.mosaic}>{covers.slice(0, 4).map((cover, index) => cell(cover, String(index)))}</View>
          ) : newestSource ? (
            <Image source={newestSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Icon name={newest ? KIND_ICON[newest.kind] : icon} size="lg" color={theme.color.onSurfaceVariant} />
          )}
          {pinned && !isNew ? (
            <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Icon name="pin" size="xs" color={theme.color.primary} />
            </View>
          ) : null}
          {selectionMode && !isNew ? (
            <View style={styles.check} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {selected ? <Icon name="check" size="xs" color={theme.color.onPrimary} /> : null}
            </View>
          ) : null}
        </View>
        <View style={[styles.label, showOptions ? styles.labelBesideOptions : null]}>
          <Text variant="labelLarge" numberOfLines={1}>{name}</Text>
          {detail ? <Text variant="labelMedium" tone="variant" numberOfLines={1}>{detail}</Text> : null}
        </View>
      </Pressable>
      {showOptions && onOptions && optionsLabel ? (
        <View style={styles.options}>
          <IconButton name="more" label={optionsLabel} onPress={onOptions} tone="variant" />
        </View>
      ) : null}
    </View>
  );
}
