/**
 * Shared root/header chrome for the two full-screen, always-black media
 * viewers (`MediaPreviewPlayer` and the image/text branch of
 * `MediaSelectionPreviewModal`). Both are deliberately excluded from
 * `Sheet`/theme colors — an immersive media surface must stay legible over
 * arbitrary content in any theme, the same reasoning `MediaCard`'s scrim
 * documents — so this only removes the literal header/root markup and style
 * duplication between them, not the "always black/white" decision itself.
 */
import {StyleSheet, View} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';

import {IconButton} from '../../design-system/components/IconButton';
import {Text} from '../../design-system/components/Text';
import type {Theme} from '../../design-system/theme';
import {neutral} from '../../design-system/tokens';

export function mediaViewerStyles(theme: Theme, insets: EdgeInsets) {
  return StyleSheet.create({
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
    footer: {
      paddingHorizontal: theme.layout.dialogPadding,
      paddingTop: theme.spacing.sm,
      paddingBottom: insets.bottom + theme.spacing.sm,
    },
  });
}

export interface MediaViewerHeaderProps {
  readonly title: string;
  readonly closeLabel: string;
  readonly onDismiss: () => void;
  readonly styles: ReturnType<typeof mediaViewerStyles>;
}

export function MediaViewerHeader({title, closeLabel, onDismiss, styles}: MediaViewerHeaderProps) {
  return (
    <View style={styles.header}>
      <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <IconButton name="close" label={closeLabel} onPress={onDismiss} />
    </View>
  );
}
