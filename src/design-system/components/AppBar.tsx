/**
 * Top app bar.
 *
 * MR-04: screen titles use sentence case and `titleLarge`. The bar consumes
 * the top safe-area inset so `Screen` does not double-pad beneath it.
 *
 * At large font scale the title is allowed to wrap to a second line rather
 * than truncate, because a screen title is orientation-critical content under
 * MR-13's truncation rule.
 *
 * `floating`: an opt-in materials treatment (apple-design "translucent
 * chrome") for screens that own a scrolling list — the bar sits absolutely
 * over the content (which must pad its top by `onHeightChange`'s value) with
 * a semi-transparent background, and only grows a hairline/shadow once
 * `scrolled` is true. This is a tinted-alpha approximation, not a real
 * `backdrop-filter` blur — this app has no blur native module, so there is
 * nothing behind the bar to actually blur, only to tint. Off by default: it
 * changes a screen's layout contract (content must reserve space for the
 * bar itself), so existing call sites are unaffected until they opt in.
 */
import {useCallback} from 'react';
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {IconName} from '../icons';
import {IconButton} from './IconButton';
import {Text} from './Text';
import {withAlpha} from '../theme/colorUtils';
import {useTheme} from '../theme/useTheme';

export interface AppBarAction {
  readonly icon: IconName;
  /** Required accessible name for an icon-only control. */
  readonly label: string;
  readonly onPress: () => void;
}

export interface AppBarProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly back?: {readonly label: string; readonly onPress: () => void};
  readonly actions?: readonly AppBarAction[];
  /**
   * Arbitrary trailing content (a `StatusPill`, a text `Button`), rendered
   * after `actions`. `actions` stays icon-only by design — it is the
   * Material top-app-bar action slot, and widening it to accept any node
   * would lose the accessible-label guarantee `AppBarAction` enforces. This
   * is the escape hatch for the tab roots, whose headers carry a status pill
   * or a "Select" affordance rather than icon buttons.
   */
  readonly trailing?: React.ReactNode;
  /** Absolutely positioned, semi-transparent, floats over scrolling content. */
  readonly floating?: boolean;
  /** True once the content beneath has scrolled — shows the edge hairline. */
  readonly scrolled?: boolean;
  /** Fires the measured bar height, so the caller can pad its content to match. */
  readonly onHeightChange?: (height: number) => void;
  readonly testID?: string;
}

export function AppBar({
  title,
  subtitle,
  back,
  actions = [],
  trailing,
  floating = false,
  scrolled = false,
  onHeightChange,
  testID,
}: AppBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => onHeightChange?.(event.nativeEvent.layout.height),
    [onHeightChange],
  );

  return (
    <View
      testID={testID}
      onLayout={floating ? onLayout : undefined}
      style={[
        {
          // `insets.top` only clears the status bar — it is not breathing
          // room. Without the extra `md` the title sits flush against the
          // clock/cutout on a real device (confirmed on a 720x1600 V2446),
          // which reads as a layout bug rather than a deliberate edge-to-edge
          // treatment.
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.xs,
          paddingBottom: theme.spacing.sm,
          backgroundColor: floating ? withAlpha(theme.color.surface, 0.85) : theme.color.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xxs,
        },
        floating ? styles.floating : null,
        floating && scrolled
          ? {
              borderBottomWidth: theme.layout.borderWidth,
              borderBottomColor: theme.color.outlineVariant,
              elevation: theme.elevation.level1,
            }
          : null,
      ]}>
      {back ? (
        // `arrowBack` mirrors automatically in RTL via the icon registry.
        <IconButton name="arrowBack" label={back.label} onPress={back.onPress} />
      ) : null}

      <View style={{flex: 1, paddingHorizontal: theme.spacing.xs}}>
        <Text variant="titleLarge" isHeading>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMedium" tone="variant">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions.map(action => (
        <IconButton
          key={action.label}
          name={action.icon}
          label={action.label}
          onPress={action.onPress}
          tone="variant"
        />
      ))}

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
