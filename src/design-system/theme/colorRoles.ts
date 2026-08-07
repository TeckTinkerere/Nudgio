/**
 * Semantic color roles.
 *
 * This is the contract every surface in the app codes against. A screen asks
 * for `theme.color.onSurfaceVariant`, never for teal. Because the role set is
 * fixed, the brand scheme and a Material You scheme are interchangeable.
 *
 * MR-04 names thirteen roles explicitly; the rest are derived in `schemes.ts`
 * with the derivation documented next to each one.
 */
export interface ColorRoles {
  /** Primary actions, selected state, key status. */
  readonly primary: string;
  readonly onPrimary: string;
  /** Low-emphasis selected cards. */
  readonly primaryContainer: string;
  readonly onPrimaryContainer: string;

  /** Snooze, warm attention, due-soon indicator. Never used for errors. */
  readonly secondary: string;
  readonly onSecondary: string;
  readonly secondaryContainer: string;
  readonly onSecondaryContainer: string;

  /** App background. */
  readonly surface: string;
  /** Cards, sheets, navigation. */
  readonly surfaceContainer: string;
  /** One step above `surfaceContainer` for stacked surfaces (dialogs on cards). */
  readonly surfaceContainerHigh: string;
  /** Primary content. */
  readonly onSurface: string;
  /** Secondary content. */
  readonly onSurfaceVariant: string;
  /** Content that is present but disabled. Never the only disabled signal. */
  readonly onSurfaceDisabled: string;

  /** Dividers and control outlines. */
  readonly outline: string;
  /** Decorative separators; lower contrast than `outline`. */
  readonly outlineVariant: string;

  /** Destructive actions and blocking errors only (MR-04). */
  readonly error: string;
  readonly onError: string;
  readonly errorContainer: string;
  readonly onErrorContainer: string;

  /** Completed/healthy state. MR-13 ACC-004: always paired with icon and text. */
  readonly success: string;
  readonly onSuccess: string;
  readonly successContainer: string;
  readonly onSuccessContainer: string;

  /** Modal and alarm backdrop, already alpha-composited. */
  readonly scrim: string;
  /** Snackbars and inverted callouts. */
  readonly inverseSurface: string;
  readonly inverseOnSurface: string;

  /** Visible 2 dp focus outline (MR-04 "States"). */
  readonly focusRing: string;
}

/**
 * Status roles used by capability, occurrence and integrity displays.
 *
 * Deliberately a separate map: MR-13 ACC-004 forbids color as the sole
 * indicator, so every consumer must also render `icon` and a translated label.
 * Bundling them keeps the trio from drifting apart.
 */
export interface StatusRole {
  /**
   * Accent drawn on the app surface: banner borders, standalone dots.
   * Verified >=3:1 against `surface`. NOT safe for content sitting on
   * `container` — use `onContainer` for that.
   */
  readonly color: string;
  readonly container: string;
  /** Text *and icon* color for content on `container`. Verified >=4.5:1. */
  readonly onContainer: string;
}

export interface StatusRoles {
  readonly ready: StatusRole;
  readonly limited: StatusRole;
  readonly actionNeeded: StatusRole;
  readonly neutral: StatusRole;
}

export type ColorRoleName = keyof ColorRoles;
