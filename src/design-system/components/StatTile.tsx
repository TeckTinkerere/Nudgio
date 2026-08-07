/**
 * A single local-history count (MR-04 "Charts and history").
 *
 * "Local history uses simple counts and accessible summaries rather than
 * competitive streak visuals... A chart must have a textual equivalent."
 * There is deliberately no chart underneath this — the number and its label
 * *are* the chart. Every count renders in the same neutral ink by default:
 * MR-13 cognitive accessibility forbids "guilt, loss aversion, red failure
 * marks for missed personal practices," and MR-03 calls out that "Completed
 * and dismissed are factual, not celebratory or shaming." `tone="positive"`
 * exists only for genuinely positive framing (a streak, a total), never to
 * mark a "bad" number — there is no attention/error tone on purpose.
 */
import {View} from 'react-native';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';


export type StatTileTone = 'neutral' | 'positive';

export interface StatTileProps {
  readonly value: number | string;
  readonly label: string;
  readonly tone?: StatTileTone;
  readonly testID?: string;
}

export function StatTile({value, label, tone = 'neutral', testID}: StatTileProps) {
  const theme = useTheme();

  const valueColor = tone === 'positive' ? theme.color.success : theme.color.onSurface;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={{
        flex: 1,
        minWidth: 96,
        borderRadius: theme.radius.card,
        backgroundColor: theme.color.surfaceContainer,
        padding: theme.spacing.sm,
        gap: 2,
      }}>
      <Text variant="headlineMedium" tabularNumbers style={{color: valueColor}}>
        {value}
      </Text>
      <Text variant="labelMedium" tone="variant">
        {label}
      </Text>
    </View>
  );
}
