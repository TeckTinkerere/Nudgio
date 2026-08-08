/**
 * MR-08 `OperationProgressEvent`: subscribes to the native `operationProgress`
 * event stream (`OperationProgressEmitter.kt`, which
 * `BackupOperationEmitter.kt` and media import both emit through) for the
 * duration one screen is showing progress for one operation kind. Filtered
 * by `kind`, not `operationId` — only one operation of a given kind is ever
 * in flight from a single screen, so there is no ambiguity, and it sidesteps
 * needing the operation id before the first event has arrived to learn it.
 *
 * Shared across features (backup export/inspection and media import) rather
 * than duplicated per feature: the wire shape and subscription lifecycle are
 * identical, and every consumer needs the same "operationId arrives via the
 * first event, then can be passed to `cancelOperation`" pattern.
 */
import {useEffect, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';

export interface OperationProgressState {
  readonly operationId: string;
  readonly phase: string;
  readonly currentItemIndex?: number;
  readonly totalItems?: number;
  /** Decimal strings (MR-08: a byte count can exceed `Number.MAX_SAFE_INTEGER`). */
  readonly completedUnits?: string;
  readonly totalUnits?: string;
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
        completedUnits: typeof payload.completedUnits === 'string' ? payload.completedUnits : undefined,
        totalUnits: typeof payload.totalUnits === 'string' ? payload.totalUnits : undefined,
      });
    });
    return () => subscription.remove();
  }, [kind, active]);

  return state;
};
