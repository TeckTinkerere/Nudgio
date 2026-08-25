/**
 * Query key factory.
 *
 * Centralized so invalidation ("everything about reminders", "just this
 * medium") is expressed once and stays consistent across every feature that
 * needs to invalidate after a mutation.
 */
import type {UUID} from '../../native-client/types';

export const queryKeys = {
  startup: () => ['startup'] as const,
  capability: () => ['capability'] as const,
  statistics: (rangeDays: number) => ['statistics', rangeDays] as const,
  preferences: () => ['preferences'] as const,
  appearance: () => ['appearance'] as const,

  media: {
    all: () => ['media'] as const,
    list: (query: unknown) => ['media', 'list', query] as const,
    detail: (id: UUID) => ['media', 'detail', id] as const,
  },

  reminders: {
    all: () => ['reminders'] as const,
    list: () => ['reminders', 'list'] as const,
    detail: (id: UUID) => ['reminders', 'detail', id] as const,
  },

  profiles: {
    all: () => ['profiles'] as const,
  },
} as const;
