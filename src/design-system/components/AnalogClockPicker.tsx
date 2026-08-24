/**
 * Analog clock face for picking an hour or a minute, shown as a modal
 * overlay — the interaction every native alarm clock uses (Android's own
 * `MaterialTimePicker`, iOS's clock app): tap a number, or drag the hand
 * around the dial and it follows your finger continuously.
 *
 * One dial, two modes, rather than two components: hour and minute differ
 * only in how many ticks there are (12 vs 60), which of them get a printed
 * label (all 12 vs every 5th), and how a pointer angle maps back to a value.
 * Forking that would guarantee the two drift apart.
 *
 * Dragging is a real gesture, not a tap fallback: `Gesture.Pan` runs on the
 * UI thread and converts the touch point to an angle on every move, so the
 * hand tracks 1:1 with no lag. `minAngle`-style hysteresis is deliberately
 * *not* used — a clock hand should start following the moment you touch it,
 * and `Gesture.Tap` composed alongside handles the "just tap a number" case
 * so neither interaction blocks the other.
 *
 * Values snap to whole units (hours 1-12, minutes 0-59): a clock is a
 * quantised control, and letting the hand rest between two minutes would
 * show a time the user cannot actually have chosen.
 */
import {useCallback} from 'react';
import {Modal, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import Svg, {Circle, G, Line, Text as SvgText} from 'react-native-svg';

import {Button} from './Button';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export type ClockMode = 'hour' | 'minute';

export interface AnalogClockPickerProps {
  readonly visible: boolean;
  readonly mode: ClockMode;
  /** 1-12 in `hour` mode, 0-59 in `minute` mode. */
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly onDismiss: () => void;
  readonly title: string;
  readonly doneLabel: string;
  readonly testID?: string;
}

/** Ticks around the face for each mode. */
const STEPS: Record<ClockMode, number> = {hour: 12, minute: 60};

/**
 * Screen point -> value. `atan2` gives an angle from the positive x-axis
 * counter-clockwise; a clock counts clockwise from 12 o'clock, hence the
 * quarter-turn offset and the modulo. Distance from centre is ignored on
 * purpose: dragging outside the dial should keep steering the hand rather
 * than dropping the gesture, which is what makes the control feel forgiving.
 */
const valueFromPoint = (x: number, y: number, radius: number, mode: ClockMode): number => {
  'worklet';
  const dx = x - radius;
  const dy = y - radius;
  const steps = STEPS[mode];
  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const step = Math.round((normalized / (2 * Math.PI)) * steps) % steps;
  return mode === 'hour' ? (step === 0 ? 12 : step) : step;
};

export function AnalogClockPicker({
  visible,
  mode,
  value,
  onChange,
  onDismiss,
  title,
  doneLabel,
  testID,
}: AnalogClockPickerProps) {
  const theme = useTheme();
  const {width} = useWindowDimensions();
  // Bounded so the dial stays reachable one-handed on a small phone and does
  // not balloon on a tablet.
  const size = Math.min(width - theme.spacing.xxl * 2, 320);
  const radius = size / 2;

  const steps = STEPS[mode];
  const angleFor = useCallback(
    (n: number) => ((mode === 'hour' ? n % 12 : n) / steps) * 2 * Math.PI - Math.PI / 2,
    [mode, steps],
  );

  const handAngle = angleFor(value);
  const handLength = radius * 0.72;
  const handX = radius + Math.cos(handAngle) * handLength;
  const handY = radius + Math.sin(handAngle) * handLength;

  const apply = useCallback(
    (next: number) => {
      if (next !== value) {
        onChange(next);
      }
    },
    [onChange, value],
  );

  const pan = Gesture.Pan()
    .onBegin(event => {
      runOnJS(apply)(valueFromPoint(event.x, event.y, radius, mode));
    })
    .onUpdate(event => {
      runOnJS(apply)(valueFromPoint(event.x, event.y, radius, mode));
    });

  const tap = Gesture.Tap().onEnd(event => {
    runOnJS(apply)(valueFromPoint(event.x, event.y, radius, mode));
  });

  // `Race`, not `Exclusive`: whichever recogniser wins wins outright, so a
  // quick tap is never swallowed waiting for a pan that is not coming.
  const gesture = Gesture.Race(pan, tap);

  // Printed labels: all twelve hours, but only every fifth minute — sixty
  // numbers on one face is unreadable, and the untouched ticks are still
  // selectable by dragging or tapping their position.
  const labels = mode === 'hour'
    ? Array.from({length: 12}, (_, i) => i + 1)
    : Array.from({length: 12}, (_, i) => i * 5);

  return (
    <Modal
      visible={visible}
      transparent
      onRequestClose={onDismiss}
      animationType={theme.a11y.reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent>
      <View style={[styles.backdrop, {backgroundColor: theme.color.scrim}]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        <View
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.color.surfaceContainerHigh,
              borderRadius: theme.radius.sheet,
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
            },
          ]}>
          <Text variant="titleMedium" isHeading align="center">
            {title}
          </Text>

          <GestureDetector gesture={gesture}>
            <View style={{width: size, height: size}}>
              <Svg width={size} height={size}>
                <Circle cx={radius} cy={radius} r={radius} fill={theme.color.surfaceContainer} />
                <G>
                  <Line
                    x1={radius}
                    y1={radius}
                    x2={handX}
                    y2={handY}
                    stroke={theme.color.primary}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Circle cx={handX} cy={handY} r={radius * 0.13} fill={theme.color.primary} />
                  <Circle cx={radius} cy={radius} r={4} fill={theme.color.primary} />
                </G>
                {labels.map(n => {
                  const a = angleFor(n);
                  const lx = radius + Math.cos(a) * handLength;
                  const ly = radius + Math.sin(a) * handLength;
                  const isSelected = mode === 'hour' ? n === value : n === value;
                  return (
                    <SvgText
                      key={n}
                      x={lx}
                      y={ly}
                      fontSize={radius * 0.13}
                      fill={isSelected ? theme.color.onPrimary : theme.color.onSurface}
                      textAnchor="middle"
                      alignmentBaseline="central">
                      {mode === 'minute' ? String(n).padStart(2, '0') : String(n)}
                    </SvgText>
                  );
                })}
              </Svg>
            </View>
          </GestureDetector>

          {/* The live value, so a drag is readable without staring at the hand. */}
          <Text variant="displaySmall" align="center" tabularNumbers>
            {mode === 'minute' ? String(value).padStart(2, '0') : String(value)}
          </Text>

          <Button label={doneLabel} onPress={onDismiss} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  sheet: {alignItems: 'center'},
});
