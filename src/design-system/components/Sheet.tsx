/**
 * Bottom sheet.
 *
 * MR-04: 28 dp top corners, elevation 3, scrim backdrop.
 * MR-13: "dialogs may become full-screen sheets" at large font scale — this
 * component expands to fill the screen above `extraLarge` rather than letting
 * its content scroll inside a short box.
 *
 * MR-13 "Motor and switch access": the backdrop press is an *enhancement*.
 * A visible close control is always rendered, because dismissing by tapping
 * outside is not reachable by switch access.
 */
import {KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {IconButton} from './IconButton';
import {Text} from './Text';
import {useResponsive} from '../layout/useResponsive';
import {useTheme} from '../theme/useTheme';


export interface SheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly title: string;
  /** Localized label for the close control, e.g. "Close". */
  readonly closeLabel: string;
  readonly children: React.ReactNode;
  readonly testID?: string;
  /** Lists own scrolling; never nest a virtualized list in the sheet ScrollView. */
  readonly scrollable?: boolean;
}

export function Sheet({
  visible,
  onDismiss,
  title,
  closeLabel,
  children,
  testID,
  scrollable = true,
}: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {isExtraLargeFontScale} = useResponsive();

  return (
    <Modal
      visible={visible}
      transparent
      // Android hardware Back must dismiss; MR-13 forbids focus traps.
      onRequestClose={onDismiss}
      animationType={theme.a11y.reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent>
      <KeyboardAvoidingView
        style={{flex: 1, justifyContent: 'flex-end'}}
        testID={testID}
        // Android's Modal opens its own window, which does not pick up the
        // Activity's adjustResize — without this the keyboard covers the
        // sheet instead of pushing it up.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          style={{flex: 1, backgroundColor: theme.color.scrim}}
          onPress={onDismiss}
          // The scrim is a shortcut, not the accessible path out.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        <View
          style={{
            backgroundColor: theme.color.surfaceContainer,
            borderTopLeftRadius: theme.radius.sheet,
            borderTopRightRadius: theme.radius.sheet,
            elevation: theme.elevation.level3,
            borderTopWidth:
              theme.appearance === 'dark' ? theme.layout.borderWidth : 0,
            borderColor: theme.color.outlineVariant,
            paddingBottom: insets.bottom,
            maxHeight: isExtraLargeFontScale ? '100%' : '80%',
            height: !scrollable ? (isExtraLargeFontScale ? '100%' : '80%') : undefined,
            flex: isExtraLargeFontScale ? 1 : undefined,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingStart: theme.layout.dialogPadding,
              paddingEnd: theme.spacing.xs,
              paddingVertical: theme.spacing.xs,
            }}>
            <Text variant="titleLarge" isHeading style={{flex: 1}}>
              {title}
            </Text>
            <IconButton name="close" label={closeLabel} onPress={onDismiss} />
          </View>

          {scrollable ? <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              paddingHorizontal: theme.layout.dialogPadding,
              paddingBottom: theme.spacing.xl,
              gap: theme.spacing.sm,
            }}>
            {children}
          </ScrollView> : <View style={{flex: 1, paddingHorizontal: theme.layout.dialogPadding,
            paddingBottom: theme.spacing.md, gap: theme.spacing.sm}}>{children}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
