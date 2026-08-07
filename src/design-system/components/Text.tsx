/**
 * Typographic primitive.
 *
 * Every string in the app renders through this component so that:
 *  - the MR-04 type scale is the only source of sizes;
 *  - system font scaling is never disabled (MR-04, MR-13 ACC-003);
 *  - control labels cannot be shrunk below a readable size to make a layout
 *    fit, which MR-13 explicitly forbids.
 */
import {Text as RNText, type StyleProp, type TextStyle} from 'react-native';

import {useTheme} from '../theme/useTheme';
import {fontFamily, nonShrinkableRoles, type TypographyToken} from '../tokens';

export type TextTone =
  | 'default'
  | 'variant'
  | 'disabled'
  | 'primary'
  | 'onPrimary'
  | 'error'
  | 'success'
  | 'inverse';

export interface TextProps {
  readonly variant?: TypographyToken;
  readonly tone?: TextTone;
  readonly children: React.ReactNode;
  readonly align?: 'auto' | 'left' | 'right' | 'center';
  /**
   * MR-13: truncation is allowed only for noncritical metadata and must have a
   * detail view. Control labels wrap instead — `Button` never sets this.
   */
  readonly numberOfLines?: number;
  /** MR-04: use tabular figures for times so digits do not shift width. */
  readonly tabularNumbers?: boolean;
  readonly style?: StyleProp<TextStyle>;
  readonly accessibilityLabel?: string;
  /**
   * Marks the node as a heading for TalkBack navigation. MR-13 requires a
   * navigable structure, not just labelled controls.
   */
  readonly isHeading?: boolean;
  readonly testID?: string;
  readonly selectable?: boolean;
}

export function Text({
  variant = 'bodyLarge',
  tone = 'default',
  children,
  align = 'auto',
  numberOfLines,
  tabularNumbers = false,
  style,
  accessibilityLabel,
  isHeading = false,
  testID,
  selectable,
}: TextProps) {
  const theme = useTheme();
  const typeStyle = theme.typography[variant];

  const colorFor = (): string => {
    switch (tone) {
      case 'variant':
        return theme.color.onSurfaceVariant;
      case 'disabled':
        return theme.color.onSurfaceDisabled;
      case 'primary':
        return theme.color.primary;
      case 'onPrimary':
        return theme.color.onPrimary;
      case 'error':
        return theme.color.error;
      case 'success':
        return theme.color.success;
      case 'inverse':
        return theme.color.inverseOnSurface;
      case 'default':
        return theme.color.onSurface;
    }
  };

  // MR-13: "action labels never reduce below body-readable size to fit".
  // A caller cannot opt a control label into shrink-to-fit.
  const allowShrink = !nonShrinkableRoles.has(variant);

  return (
    <RNText
      style={[
        {
          fontSize: typeStyle.fontSize,
          lineHeight: typeStyle.lineHeight,
          fontWeight: typeStyle.fontWeight,
          letterSpacing: typeStyle.letterSpacing,
          color: colorFor(),
          textAlign: align,
          fontFamily: tabularNumbers ? fontFamily.tabular : fontFamily.sans,
          // MR-13 "RTL support": use start/end, not left/right.
          writingDirection: theme.isRtl ? 'rtl' : 'ltr',
        },
        style,
      ]}
      // Never `allowFontScaling={false}` — MR-04 forbids it outright.
      allowFontScaling
      maxFontSizeMultiplier={allowShrink ? undefined : undefined}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isHeading ? 'header' : undefined}
      selectable={selectable}
      testID={testID}>
      {children}
    </RNText>
  );
}
