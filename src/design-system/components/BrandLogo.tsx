/**
 * The Nudgio app icon, drawn from `assets/brand/nudgio-mark.svg`.
 *
 * This used to be an `<Image>` of the 1.5 MB approved JPEG, which was the
 * only artwork that existed at the time. It is now the same vector the
 * launcher icon and the website are drawn from, so the icon on the home
 * screen and the icon on the About screen are provably the same shape
 * rather than two renders that happen to look alike. Removing the bitmap
 * also takes its weight out of the download.
 *
 * The geometry below is the master's, unchanged, and
 * `scripts/build-brand-assets.py` fails if this file and the master ever
 * disagree. Placement matches the adaptive icon: the master's 968-unit mark
 * box sits on the central half of a 1936-unit canvas, so the only transform
 * is a translate of (-67, -28) carrying the master's origin (551,512) to the
 * 484-unit inset. No scale factor, which is why these numbers still read the
 * same as the master's.
 *
 * Colours are fixed, not themed. This is the app's icon — the same artifact
 * the launcher draws — and the cream plate is what earns that: it is load
 * bearing, not decoration. Measured against the app's own surfaces:
 *
 *   plate on the light surface   1.00:1   invisible, so the mark appears to
 *                                         float on the page
 *   plate on the dark surface   16.76:1   reads as the icon tile
 *
 * Drop the plate and the fixed mark would sit straight on the surface at
 * 2.49:1 in dark — the same defect the website had before its mark was made
 * theme-aware. Here the plate solves it instead, which is what lets the
 * artwork stay fixed rather than being recoloured per theme.
 */
import {View, type StyleProp, type ViewStyle} from 'react-native';
// Aliased for the reason spelled out in `src/design-system/icons/Icon.tsx`:
// `react-native-svg` exports `Svg` as both the default and a named export.
import SvgRoot, {Circle, G, Path, Rect} from 'react-native-svg';

/** The adaptive-icon canvas: one 968-unit mark box on its central half. */
const VIEWPORT = 1936;
const TRANSLATE_X = -67;
const TRANSLATE_Y = -28;

/** 24 dp of corner on the old 128 dp image, kept proportional. */
const PLATE_RADIUS = (VIEWPORT * 24) / 128;

const PLATE = '#F7F4EE';
const MARK = '#2D4DB5';
const ACCENT = '#E9B58E';

const STEM = 'M715,788 L715,1358';
const SHOULDER = 'M718,1350 C718,1050 720,772 1037,772 C1250,772 1241,850 1241,1350';
const CHIME_UPPER = 'M1026,536 C1120,536 1215,560 1259,598';
const CHIME_LOWER = 'M1412,799 C1448,860 1456,930 1452,998';

export interface BrandLogoProps {
  /** Rendered size in dp. Vector, so any value is sharp. */
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function BrandLogo({size = 128, style, testID}: BrandLogoProps) {
  return (
    <View
      style={[{width: size, height: size}, style]}
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <SvgRoot width={size} height={size} viewBox={`0 0 ${VIEWPORT} ${VIEWPORT}`}>
        <Rect
          x={0}
          y={0}
          width={VIEWPORT}
          height={VIEWPORT}
          rx={PLATE_RADIUS}
          fill={PLATE}
        />
        <G translateX={TRANSLATE_X} translateY={TRANSLATE_Y}>
          <Path
            d={STEM}
            fill="none"
            stroke={MARK}
            strokeWidth={242}
            strokeLinecap="round"
          />
          <Path
            d={SHOULDER}
            fill="none"
            stroke={MARK}
            strokeWidth={224}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={CHIME_UPPER}
            fill="none"
            stroke={MARK}
            strokeWidth={49}
            strokeLinecap="round"
          />
          <Path
            d={CHIME_LOWER}
            fill="none"
            stroke={MARK}
            strokeWidth={49}
            strokeLinecap="round"
          />
          <Circle cx={1372} cy={671} r={73} fill={ACCENT} />
        </G>
      </SvgRoot>
    </View>
  );
}
