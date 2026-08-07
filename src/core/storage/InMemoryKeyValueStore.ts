/**
 * In-memory `KeyValueStore`.
 *
 * The default implementation in v1. Because this store holds only disposable
 * view state (see `KeyValueStore`), losing it on process death is correct
 * behavior rather than a limitation — the authoritative state is refetched
 * from the native startup snapshot.
 *
 * Values are structurally cloned on write and read so a caller cannot mutate
 * stored state by holding onto the object it passed in.
 */
import type {AppError} from '../errors';
import type {KeyValueStore} from './KeyValueStore';
import {ok, type Result} from '../result/Result';

const clone = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const createInMemoryKeyValueStore = (
  seed: Readonly<Record<string, unknown>> = {},
): KeyValueStore => {
  const entries = new Map<string, unknown>(Object.entries(seed));

  return {
    get: async <T>(key: string): Promise<Result<T | null, AppError>> => {
      const value = entries.get(key);
      return ok(value === undefined ? null : clone(value as T));
    },
    set: async <T>(key: string, value: T): Promise<Result<void, AppError>> => {
      entries.set(key, clone(value));
      return ok(undefined);
    },
    remove: async (key: string): Promise<Result<void, AppError>> => {
      entries.delete(key);
      return ok(undefined);
    },
    clear: async (): Promise<Result<void, AppError>> => {
      entries.clear();
      return ok(undefined);
    },
  };
};
