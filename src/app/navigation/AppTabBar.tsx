/**
 * Custom tab bar/rail that switches treatment by width class.
 *
 * MR-04 responsive table: "Compact: Bottom navigation" vs. "Medium/Expanded:
 * Navigation rail". Built directly on design-system primitives (not a
 * third-party tab bar) so tokens, RTL and the 48 dp target floor apply
 * uniformly, and so MR-13's "labels remain visible or switch to navigation
 * rail on wider layouts" is one code path instead of two libraries.
 */
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {tabRoutes} from '../../constants/routes';
import {Icon, Text, transparent, useResponsive, useRippleConfig, useTheme} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTranslation} from '../../localization';

const ICON_FOR: Record<string, IconName> = {
  [tabRoutes.today]: 'today',
  [tabRoutes.library]: 'library',
  [tabRoutes.reminders]: 'reminders',
  [tabRoutes.settings]: 'settings',
};

const LABEL_KEY_FOR: Record<string, 'nav.today' | 'nav.library' | 'nav.reminders' | 'nav.settings'> = {
  [tabRoutes.today]: 'nav.today',
  [tabRoutes.library]: 'nav.library',
  [tabRoutes.reminders]: 'nav.reminders',
  [tabRoutes.settings]: 'nav.settings',
};

export function AppTabBar({state, navigation}: BottomTabBarProps) {
  const theme = useTheme();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const {navigation: treatment, isLargeFontScale} = useResponsive();
  const ripple = useRippleConfig();

  const isRail = treatment === 'rail';

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: isRail ? 'column' : 'row',
        backgroundColor: theme.color.surfaceContainer,
        borderTopWidth: isRail ? 0 : theme.layout.borderWidth,
        borderRightWidth: isRail ? theme.layout.borderWidth : 0,
        borderColor: theme.color.outlineVariant,
        paddingBottom: isRail ? theme.spacing.md : insets.bottom,
        paddingTop: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        gap: theme.spacing.xs,
        width: isRail ? 96 : undefined,
      }}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const label = t(LABEL_KEY_FOR[route.name] ?? 'nav.today');

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          // Pressable, not a bare touch handler: MR-13 "Motor and switch
          // access" requires every function to have a real focusable control,
          // not a touch-only handler that switch access cannot reach.
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{selected: isFocused}}
            accessibilityLabel={label}
            android_ripple={ripple}
            style={{
              flex: isRail ? undefined : 1,
              minHeight: theme.layout.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: theme.spacing.xxs,
              borderRadius: theme.radius.chip,
              backgroundColor: isFocused
                ? theme.color.secondaryContainer
                : transparent,
            }}>
            <Icon
              name={ICON_FOR[route.name] ?? 'today'}
              color={isFocused ? theme.color.onSecondaryContainer : theme.color.onSurfaceVariant}
            />
            {/*
              MR-13: labels remain visible except at extreme scale, where they
              would otherwise overflow the bar; the icon plus accessibilityLabel
              keeps the tab nameable either way.
            */}
            {isLargeFontScale ? null : (
              <Text
                variant="labelMedium"
                style={{
                  color: isFocused
                    ? theme.color.onSecondaryContainer
                    : theme.color.onSurfaceVariant,
                }}>
                {label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
