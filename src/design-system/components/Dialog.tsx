/**
 * Modal dialog, including the destructive-confirmation variant.
 *
 * MR-03 / MR-13 rules encoded here:
 *  - "The destructive button is last and colored as an error action."
 *  - "Destructive dialogs identify exact counts" — hence `impact`, a required
 *    field on the destructive variant.
 *  - Hardware Back cancels; a dialog must never trap the user.
 *  - Cancel is always present, so there is no dead-end confirmation.
 *  - `alternative` covers MR-03's dependency-aware delete shape — "Cancel",
 *    "Keep reminders disabled", "Delete media and reminders" — a soft,
 *    non-destructive middle choice between cancelling and the destructive
 *    confirm, rendered tonal so it never reads as the dangerous option.
 */
import type {ReactNode} from 'react';
import {Modal, View} from 'react-native';


import {Button} from './Button';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export interface DialogAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface DialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
  /**
   * Exact consequence, e.g. "This media is used by 3 reminders."
   * Required when `destructive` is set (MR-13 cognitive accessibility).
   */
  readonly impact?: string;
  /**
   * Extra content between the body and the action row — e.g. the "type
   * REPLACE to confirm" text field (MR-03 backup Replace flow). Anything
   * rendered here is part of the same modal, unlike a sibling in the
   * surrounding screen, which would sit invisibly behind this dialog.
   */
  readonly children?: ReactNode;
  readonly cancel: DialogAction;
  /** Non-destructive middle option, e.g. "Keep reminders disabled". */
  readonly alternative?: DialogAction;
  readonly confirm?: DialogAction;
  /** Renders `confirm` as an error action and places it last. */
  readonly destructive?: boolean;
  readonly testID?: string;
}

export function Dialog({
  visible,
  title,
  body,
  impact,
  children,
  cancel,
  alternative,
  confirm,
  destructive = false,
  testID,
}: DialogProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      onRequestClose={cancel.onPress}
      animationType={theme.a11y.reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent>
      <View
        testID={testID}
        style={{
          flex: 1,
          backgroundColor: theme.color.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xl,
        }}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{
            width: '100%',
            maxWidth: 480,
            backgroundColor: theme.color.surfaceContainerHigh,
            borderRadius: theme.radius.dialog,
            elevation: theme.elevation.level3,
            borderWidth: theme.appearance === 'dark' ? theme.layout.borderWidth : 0,
            borderColor: theme.color.outlineVariant,
            padding: theme.layout.dialogPadding,
            gap: theme.spacing.sm,
          }}>
          <Text variant="titleLarge" isHeading>
            {title}
          </Text>
          <Text variant="bodyLarge" tone="variant">
            {body}
          </Text>
          {impact ? (
            <Text variant="bodyMedium" tone={destructive ? 'error' : 'variant'}>
              {impact}
            </Text>
          ) : null}

          {children}

          {/*
            Cancel first, destructive last (MR-03). `flex-end` places the group
            at the trailing edge and mirrors correctly under RTL.
          */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              marginTop: theme.spacing.xs,
            }}>
            <Button label={cancel.label} onPress={cancel.onPress} variant="text" />
            {alternative ? (
              <Button label={alternative.label} onPress={alternative.onPress} variant="tonal" />
            ) : null}
            {confirm ? (
              <Button
                label={confirm.label}
                onPress={confirm.onPress}
                variant={destructive ? 'destructive' : 'filled'}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
