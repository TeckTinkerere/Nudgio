/**
 * Icon registry.
 *
 * MR-04 specifies "Material Symbols Rounded with a consistent optical size".
 * The glyphs below are hand-authored on the same 24 dp grid so the app has a
 * complete, self-contained icon set with no font binary and no network fetch
 * (ADR-015 forbids Internet access; a webfont CDN is not an option).
 *
 * This file is the single swap point: dropping in the licensed Material
 * Symbols path data means replacing `paths` here and changing nothing else,
 * because every call site refers to a semantic `IconName`.
 *
 * Each entry declares:
 *  - `paths`      one or more SVG `d` commands on a 0 0 24 24 viewBox;
 *  - `mirrorInRtl` MR-13: arrows mirror in RTL, Play and media transport do NOT;
 *  - `rule`       'evenodd' where a glyph needs a hole.
 */

export interface IconDefinition {
  readonly paths: readonly string[];
  /**
   * MR-13 "RTL support": "correct icon mirroring for arrows, not Play symbols".
   * Defaults to false — mirroring is opt-in so a new icon is never silently
   * flipped into nonsense.
   */
  readonly mirrorInRtl?: boolean;
  readonly rule?: 'evenodd' | 'nonzero';
}

export const iconRegistry = {
  // --- Primary alarm actions (MR-04 "Iconography") ---------------------------
  /** Filled play arrow. Never mirrored: it is a transport control. */
  play: {paths: ['M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z']},
  pause: {paths: ['M7 5h3.5v14H7zM13.5 5H17v14h-3.5z']},
  /** Snooze: a clock face with a plus, paired with a visible text label. */
  snooze: {
    paths: [
      'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7z',
      'M12.75 7.5h-1.5v5.06l3.72 2.23.78-1.28-3-1.8z',
    ],
  },
  /** Close / dismiss. MR-04: only used bare when a visible "Dismiss" is present. */
  close: {paths: ['M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.88 18.3 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z']},

  // --- Navigation destinations ----------------------------------------------
  /** Today: calendar. */
  today: {
    paths: [
      'M7 2v2h10V2h2v2h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V2zM4 9v11h16V9z',
      'M6.5 11.5h4v4h-4z',
    ],
  },
  /** Library: stacked media. */
  library: {
    paths: [
      'M3 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h12V7z',
      'M19 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2z',
    ],
  },
  /** Reminders: alarm clock. */
  reminders: {
    paths: [
      'M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6z',
      'M12.75 8h-1.5v4.31l3.22 1.94.78-1.28-2.5-1.5z',
      'M5.4 1.7 1.6 4.9 2.9 6.4l3.8-3.2zM18.6 1.7l-1.3 1.5 3.8 3.2 1.3-1.5z',
    ],
  },
  settings: {
    paths: [
      'M12 8.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5zm0 5A1.5 1.5 0 1 1 13.5 12 1.5 1.5 0 0 1 12 13.5z',
      'M19.4 12a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.6 3H9.4l-.4 2.7a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.7h5.2l.4-2.7a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5a7.4 7.4 0 0 0 .1-1.2z',
    ],
    rule: 'evenodd',
  },

  // --- Status and health ----------------------------------------------------
  /** Health: shield with a check (MR-04). */
  health: {
    paths: [
      'M12 2 4 5.2v6c0 5 3.4 9.7 8 10.8 4.6-1.1 8-5.8 8-10.8v-6z',
      'M10.9 15.4 7.6 12.1 9 10.7l1.9 1.9 4.1-4.1 1.4 1.4z',
    ],
    rule: 'evenodd',
  },
  check: {paths: ['M9.55 17.6 4 12.05l1.4-1.42 4.15 4.15 9.05-9.05L20 7.15z']},
  /** Blocking error / action needed. */
  alert: {
    paths: [
      'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z',
      'M11 7h2v7h-2zM11 15.5h2v2h-2z',
    ],
  },
  /** Non-blocking warning / limited. */
  warning: {
    paths: [
      'M12 3.2 1.4 20.8h21.2zM12 7.2l6.9 11.6H5.1z',
      'M11 10.5h2v4.5h-2zM11 16.2h2v2h-2z',
    ],
  },
  info: {
    paths: [
      'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z',
      'M11 10.5h2V17h-2zM11 6.8h2v2h-2z',
    ],
  },

  // --- Media kinds (MR-08 MediaKind) ----------------------------------------
  video: {paths: ['M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm15.2 3.4L23 5.8v12.4l-4.8-2.6z']},
  audio: {
    paths: [
      'M12 2.5a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-7 0V6A3.5 3.5 0 0 1 12 2.5z',
      'M5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h-2v-3.07A7 7 0 0 1 5 11z',
    ],
  },
  image: {
    paths: [
      'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6z',
      'M6.5 16.5 10 12l2.5 3 3-4 3.5 5.5z',
      'M8.25 9.75a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z',
    ],
  },
  text: {paths: ['M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h16V5z', 'M6.5 8h11v1.8h-11zM6.5 11.6h11v1.8h-11zM6.5 15.2h7v1.8h-7z']},
  /** Missing media (MR-04): a broken file, never an empty gray rectangle. */
  mediaMissing: {
    paths: [
      'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6z',
      'M11 8h2v5h-2zM11 14.5h2v2h-2z',
    ],
  },

  // --- Actions ---------------------------------------------------------------
  add: {paths: ['M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z']},
  edit: {paths: ['M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z']},
  delete: {paths: ['M9 3h6l1 1.5h4v2H4v-2h4zM6 8h12l-.9 12.1A2 2 0 0 1 15.1 22H8.9a2 2 0 0 1-2-1.9z']},
  search: {paths: ['M10 3a7 7 0 1 0 4.24 12.56l4.6 4.6 1.42-1.42-4.6-4.6A7 7 0 0 0 10 3zm0 2a5 5 0 1 1-5 5 5 5 0 0 1 5-5z']},
  filter: {paths: ['M3 5h18v2.2l-6.8 6.8V21l-4.4-2.6v-4.4L3 7.2z']},
  sort: {paths: ['M3 6h12v2H3zM3 11h8v2H3zM3 16h4v2H3zM18 8v9.2l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V8z']},
  /** Overflow. Vertical, so never mirrored. */
  more: {paths: ['M12 4.5a2 2 0 1 1-2 2 2 2 0 0 1 2-2zM12 10a2 2 0 1 1-2 2 2 2 0 0 1 2-2zM12 15.5a2 2 0 1 1-2 2 2 2 0 0 1 2-2z']},
  share: {paths: ['M18 16.1a2.9 2.9 0 0 0-1.96.77L8.9 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A3 3 0 1 0 15 5a3.3 3.3 0 0 0 .07.7L8.02 9.81a3 3 0 1 0 0 4.38l7.12 4.16a2.8 2.8 0 0 0-.07.6A2.9 2.9 0 1 0 18 16.1z']},
  /** Backup / archive with a directional arrow (MR-04). */
  backup: {
    paths: [
      'M3 4h18v4H3zM4.5 9.5h15V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z',
      'M12 11.2 8.6 14.6 10 16l1-1v3h2v-3l1 1 1.4-1.4z',
    ],
    rule: 'evenodd',
  },
  download: {paths: ['M11 3h2v9.2l3.3-3.3 1.4 1.4-5.7 5.7-5.7-5.7 1.4-1.4L11 12.2zM4 18h16v2H4z']},
  upload: {paths: ['M12 3.1 6.3 8.8l1.4 1.4L11 6.9V16h2V6.9l3.3 3.3 1.4-1.4zM4 18h16v2H4z']},
  /** Profile / alert tuning (MR-04 "tune"). */
  profile: {paths: ['M3 6h8v2H3zM15 6h6v2h-6zM3 16h6v2H3zM13 16h8v2h-8z', 'M13 4h2v6h-2zM9 14h2v6H9z']},
  notification: {
    paths: [
      'M12 2.5a1.4 1.4 0 0 1 1.4 1.4v.7a5.6 5.6 0 0 1 4.2 5.4v4l1.9 2.2V18H4.5v-1.8L6.4 14v-4a5.6 5.6 0 0 1 4.2-5.4v-.7A1.4 1.4 0 0 1 12 2.5z',
      'M9.9 19.2h4.2a2.1 2.1 0 0 1-4.2 0z',
    ],
  },
  lock: {
    paths: [
      'M12 2a4.5 4.5 0 0 0-4.5 4.5V9H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1.5V6.5A4.5 4.5 0 0 0 12 2zm0 2a2.5 2.5 0 0 1 2.5 2.5V9h-5V6.5A2.5 2.5 0 0 1 12 4z',
    ],
    rule: 'evenodd',
  },
  repeat: {paths: ['M7 5h10v2.5L21 4l-4-3.5V3H5v6h2zM17 19H7v-2.5L3 20l4 3.5V21h12v-6h-2z'], mirrorInRtl: true},
  clock: {
    paths: [
      'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z',
      'M12.75 7h-1.5v5.56l3.72 2.23.78-1.28-3-1.8z',
    ],
  },

  // --- Directional. All mirror in RTL (MR-13). -------------------------------
  chevronRight: {paths: ['M9.3 5.7 15.6 12l-6.3 6.3-1.4-1.4 4.9-4.9-4.9-4.9z'], mirrorInRtl: true},
  chevronLeft: {paths: ['M14.7 5.7 8.4 12l6.3 6.3 1.4-1.4-4.9-4.9 4.9-4.9z'], mirrorInRtl: true},
  arrowBack: {paths: ['M20 11H7.8l4.6-4.6L11 5l-7 7 7 7 1.4-1.4L7.8 13H20z'], mirrorInRtl: true},
  chevronDown: {paths: ['M5.7 9.3 12 15.6l6.3-6.3-1.4-1.4-4.9 4.9-4.9-4.9z']},
  chevronUp: {paths: ['M18.3 14.7 12 8.4l-6.3 6.3 1.4 1.4 4.9-4.9 4.9 4.9z']},
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof iconRegistry;

export const iconNames = Object.keys(iconRegistry) as readonly IconName[];

/**
 * Typed accessor for a registry entry.
 *
 * `iconRegistry[name]` directly, with `name: IconName`, indexes a
 * const-narrowed object with a *union* of keys — TS distributes that over
 * each literal member rather than merging their optional fields
 * (`mirrorInRtl`, `rule`), so the result reads as missing those properties
 * even though `IconDefinition` declares them as optional. Routing the lookup
 * through a function with an explicit `IconDefinition` return type resolves
 * to the interface shape instead.
 */
export const getIconDefinition = (name: IconName): IconDefinition => iconRegistry[name];

/** Optical sizes. `md` is the MR-04 baseline for inline and button icons. */
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

export type IconSizeToken = keyof typeof iconSize;
