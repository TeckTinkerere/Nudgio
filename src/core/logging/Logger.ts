/**
 * Structured logging.
 *
 * MR-07 "Observability": local diagnostics use "bounded files and privacy-safe
 * event fields" and explicitly exclude "content titles or file paths".
 *
 * The interface is injected rather than imported as a singleton so that:
 *  - tests assert on emitted events instead of stubbing `console`;
 *  - release builds get a no-op implementation and the calls tree-shake to
 *    nothing meaningful;
 *  - persistent diagnostics can later be routed to the native ring buffer
 *    without touching a single call site.
 *
 * ESLint bans bare `console` in product code, so this is the only way to log.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured fields. Primitives only — an object would invite passing a whole
 * DTO, which is how titles and paths leak into diagnostics.
 */
export type LogFields = Readonly<Record<string, string | number | boolean>>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Returns a logger that stamps `fields` onto every subsequent entry. */
  child(fields: LogFields): Logger;
}

/** Release default. Every call is a cheap no-op. */
export const createNoopLogger = (): Logger => {
  const noop: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => noop,
  };
  return noop;
};

/**
 * Development logger.
 *
 * `console` is referenced here and nowhere else in the codebase; the ESLint
 * override for this file is what makes that enforceable.
 */
export const createConsoleLogger = (base: LogFields = {}): Logger => {
  const emit = (level: LogLevel, event: string, fields?: LogFields): void => {
    const payload = {level, event, ...base, ...fields};
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
  };

  return {
    debug: (event, fields) => emit('debug', event, fields),
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
    child: fields => createConsoleLogger({...base, ...fields}),
  };
};

/** Captures entries for assertions. Used by `src/testing`. */
export interface RecordedLog {
  readonly level: LogLevel;
  readonly event: string;
  readonly fields: LogFields;
}

export interface RecordingLogger extends Logger {
  readonly entries: readonly RecordedLog[];
  clear(): void;
}

export const createRecordingLogger = (base: LogFields = {}): RecordingLogger => {
  const entries: RecordedLog[] = [];

  const build = (scope: LogFields): RecordingLogger => ({
    entries,
    clear: () => {
      entries.length = 0;
    },
    debug: (event, fields) =>
      entries.push({level: 'debug', event, fields: {...scope, ...fields}}),
    info: (event, fields) =>
      entries.push({level: 'info', event, fields: {...scope, ...fields}}),
    warn: (event, fields) =>
      entries.push({level: 'warn', event, fields: {...scope, ...fields}}),
    error: (event, fields) =>
      entries.push({level: 'error', event, fields: {...scope, ...fields}}),
    child: fields => build({...scope, ...fields}),
  });

  return build(base);
};
