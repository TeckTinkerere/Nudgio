/**
 * Generic key-value storage abstraction.
 *
 * IMPORTANT (ADR-004): this is NOT where user data lives. Room is the logical
 * source of truth and DataStore owns preferences, both on the Kotlin side.
 * This store is only for *disposable view state* — the last selected library
 * filter, a collapsed section, a scroll anchor. MR-07: "React state is
 * disposable; killing the JS process must not lose user intent."
 *
 * The interface exists so that a future persistent backend can be dropped in
 * without touching callers, and so tests get a synchronous in-memory double.
 */
import type {AppError} from '../errors';
import type {Result} from '../result/Result';

export interface KeyValueStore {
  get<T>(key: string): Promise<Result<T | null, AppError>>;
  set<T>(key: string, value: T): Promise<Result<void, AppError>>;
  remove(key: string): Promise<Result<void, AppError>>;
  /** Clears everything this store owns. Never touches Room or DataStore. */
  clear(): Promise<Result<void, AppError>>;
}
