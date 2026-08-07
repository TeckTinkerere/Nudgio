/**
 * Icon renderer.
 *
 * Accessibility contract (MR-13 ACC-001, MR-04 "Iconography"):
 *  - An icon is decorative by default and is hidden from assistive tech.
 *  - Passing `label` promotes it to an `image` with an accessible name.
 *  - An *icon-only button* must not rely on this: it uses `IconButton`, which
 *    requires a label at the type level.
 */
import {useMemo} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
// Aliased: `react-native-svg` exports `Svg` both as the default and as a
// named export of the same component, which trips `import/no-named-as-default`
// on a plain default import. `SvgRoot` sidesteps the warning without losing
// anything — `Svg` is still available elsewhere if a future addition needs it.
import SvgRoot, {Path} from 'react-native-svg';

import {getIconDefinition, iconSize, type IconName, type IconSizeToken} from './iconRegistry';
import {useTheme} from '../theme/useTheme';


export interface IconProps {
  readonly name: IconName;
  /** Token or explicit dp. Defaults to the 24 dp MR-04 baseline. */
  readonly size?: IconSizeToken | number;
  /** Any resolved color. Defaults to the current primary content color. */
  readonly color?: string;
  /**
   * Accessible name. Omit for decorative icons that sit beside a text label —
   * announcing both would make TalkBack read the concept twice.
   */
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

const resolveSize = (size: IconProps['size']): number => {
  if (size === undefined) {
    return iconSize.md;
  }
  return typeof size === 'number' ? size : iconSize[size];
};

export function Icon({name, size, color, label, style, testID}: IconProps) {
  const theme = useTheme();
  const definition = getIconDefinition(name);
  const dimension = resolveSize(size);
  const fill = color ?? theme.color.onSurface;

  // MR-13: mirror arrows in RTL, never transport controls. The registry, not
  // the caller, decides which is which.
  const shouldMirror = theme.isRtl && definition.mirrorInRtl === true;

  const transform = useMemo(
    () => (shouldMirror ? [{scaleX: -1 as const}] : undefined),
    [shouldMirror],
  );

  const accessibility = label
    ? ({
        accessible: true,
        accessibilityRole: 'image' as const,
        accessibilityLabel: label,
      } as const)
    : ({
        accessible: false,
        importantForAccessibility: 'no-hide-descendants' as const,
      } as const);

  return (
    <View
      style={[{width: dimension, height: dimension, transform}, style]}
      testID={testID}
      {...accessibility}>
      <SvgRoot width={dimension} height={dimension} viewBox="0 0 24 24">
        {definition.paths.map((d, index) => (
          <Path
            // Path order within an icon is stable, so the index is a valid key.
            key={`${name}-${index}`}
            d={d}
            fill={fill}
            fillRule={definition.rule ?? 'nonzero'}
          />
        ))}
      </SvgRoot>
    </View>
  );
}
