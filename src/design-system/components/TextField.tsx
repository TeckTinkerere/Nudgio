/**
 * Text input.
 *
 * MR-13 requirements encoded here:
 *  - "editor labels remain above fields" at large font scale — the label is
 *    always above, never a placeholder-only float;
 *  - "Error copy appears next to the field" — `error` renders inline and is
 *    announced via `accessibilityErrorMessage`;
 *  - the editor "preserves entered values after a permission or validation
 *    issue", so this component never clears itself on error.
 */
import {useState} from 'react';
import {TextInput, View, type KeyboardTypeOptions} from 'react-native';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';


export interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  /** Supporting copy shown below the field when there is no error. */
  readonly helper?: string;
  /** Localized validation message. Presence switches the field to error state. */
  readonly error?: string;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly maxLength?: number;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  helper,
  error,
  placeholder,
  multiline = false,
  maxLength,
  keyboardType,
  disabled = false,
  required = false,
  testID,
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const hasError = error !== undefined && error.length > 0;

  const borderColor = hasError
    ? theme.color.error
    : focused
      ? theme.color.focusRing
      : theme.color.outline;

  return (
    <View style={{gap: theme.spacing.xxs}}>
      <Text variant="labelLarge" tone={disabled ? 'disabled' : 'variant'}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.color.onSurfaceDisabled}
        editable={!disabled}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        testID={testID}
        accessibilityLabel={label}
        accessibilityState={{disabled}}
        accessibilityHint={hasError ? undefined : helper}
        aria-required={required}
        aria-invalid={hasError}
        aria-errormessage={hasError ? error : undefined}
        allowFontScaling
        style={{
          minHeight: multiline ? 96 : theme.layout.minTouchTarget,
          borderWidth: focused
            ? theme.layout.focusRingWidth
            : theme.layout.borderWidth,
          borderColor,
          borderRadius: theme.radius.field,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          color: disabled ? theme.color.onSurfaceDisabled : theme.color.onSurface,
          backgroundColor: disabled
            ? theme.color.surfaceContainer
            : theme.color.surface,
          fontSize: theme.typography.bodyLarge.fontSize,
          textAlignVertical: multiline ? 'top' : 'center',
          // MR-13: use writing direction rather than hardcoded alignment.
          writingDirection: theme.isRtl ? 'rtl' : 'ltr',
        }}
      />

      {hasError ? (
        <Text variant="bodyMedium" tone="error" accessibilityLabel={error}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="bodyMedium" tone="variant">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
