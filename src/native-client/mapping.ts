/**
 * Wire <-> domain conversion for the one boundary where `NativeMediaReminder.ts`'s
 * Codegen-shaped `Spec` types and `./types.ts`'s rich domain types meet
 * (`docs/decision-log.md` DL-042/DL-045).
 *
 * Every wire DTO is runtime-identical to its domain counterpart — branding
 * has no runtime representation, and `ScheduleRuleWire`'s flattened shape
 * and `ScheduleRuleDto`'s discriminated union describe the exact same JSON
 * object, just typed differently. `decodeWire` documents that at the one
 * seam it's needed instead of scattering `as unknown as X` through
 * `MediaReminderClient.ts` and the mock/demo modules — it is a type-level
 * boundary marker, not a deep schema validator (this codebase does not have
 * one for success payloads; native is trusted to produce values actually
 * matching the wire shape, same as before this file existed).
 *
 * The reverse direction (domain -> wire, e.g. passing a `SaveReminderRequest`
 * where `SaveReminderRequestWire` is expected) needs no helper: a domain
 * value already structurally satisfies its wire counterpart (branded fields
 * upcast to `string` for free; each `ScheduleRuleDto` variant already has
 * every field `ScheduleRuleWire` allows), so it passes straight through.
 */
import type {ScheduleRuleWire} from './NativeMediaReminder';
import type {ScheduleRuleDto} from './types';

/**
 * @see this file's module doc for why this cast is safe: wire and domain
 * types are runtime-identical, only TypeScript's structural checks differ.
 */
export const decodeWire = <T>(wire: unknown): T => wire as T;

/**
 * The one wire type that needs real narrowing logic rather than a plain
 * cast: `ScheduleRuleWire` is a single flattened object where `type` alone
 * doesn't let TypeScript discriminate which other fields are actually
 * present the way `ScheduleRuleDto`'s real union does.
 */
export const decodeScheduleRule = (wire: ScheduleRuleWire): ScheduleRuleDto => {
  switch (wire.type) {
    case 'once':
      return {
        type: 'once',
        instant: decodeWire(wire.instant),
        originZone: decodeWire(wire.originZone ?? 'UTC'),
      };
    case 'daily':
      return {type: 'daily', localTime: decodeWire(wire.localTime), zonePolicy: 'follow_device'};
    case 'weekdays':
      return {
        type: 'weekdays',
        localTime: decodeWire(wire.localTime),
        isoWeekdays: wire.isoWeekdays ?? [],
        zonePolicy: 'follow_device',
      };
    case 'monthly':
      return {
        type: 'monthly',
        localTime: decodeWire(wire.localTime),
        dayOfMonth: decodeWire(wire.dayOfMonth),
        zonePolicy: 'follow_device',
      };
    case 'yearly':
      return {
        type: 'yearly',
        localTime: decodeWire(wire.localTime),
        month: decodeWire(wire.month),
        dayOfMonth: decodeWire(wire.dayOfMonth),
        zonePolicy: 'follow_device',
      };
    case 'custom':
      return {
        type: 'custom',
        localTime: decodeWire(wire.localTime),
        intervalDays: decodeWire(wire.intervalDays),
        anchorDate: decodeWire(wire.anchorDate),
        zonePolicy: 'follow_device',
      };
  }
};
