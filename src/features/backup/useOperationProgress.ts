/**
 * MR-08 `OperationProgressEvent`: subscribes to the native `operationProgress`
 * event stream ([`ReminderEventEmitter`](../../../android)'s sibling in
 * `BackupOperationEmitter.kt`) for the duration one export/import screen is
 * showing progress. Filtered by `kind`, not `operationId` — only one backup
 * operation is ever in flight from this UI at a time, so there is no
 * ambiguity, and it sidesteps needing the operation id before the first
 * event has arrived to learn it.
 */
import {useEffect, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';

export interface OperationProgressState {
  readonly operationId: string;
  readonly phase: string;
  readonly currentItemIndex?: number;
  readonly totalItems?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const useOperationProgress = (kind: string, active: boolean): OperationProgressState | null => {
  const [state, setState] = useState<OperationProgressState | null>(null);

  useEffect(() => {
    if (!active) {
      setState(null);
      return undefined;
    }
    const subscription = DeviceEventEmitter.addListener('operationProgress', payload => {
      if (!isRecord(payload) || payload.kind !== kind) {
        return;
      }
      if (typeof payload.operationId !== 'string' || typeof payload.phase !== 'string') {
        return;
      }
      setState({
        operationId: payload.operationId,
        phase: payload.phase,
        currentItemIndex: typeof payload.currentItemIndex === 'number' ? payload.currentItemIndex : undefined,
        totalItems: typeof payload.totalItems === 'number' ? payload.totalItems : undefined,
      });
    });
    return () => subscription.remove();
  }, [kind, active]);

  return state;
};
