/**
 * Contrast regression suite (MR-13 ACC-005).
 *
 * MR-13 states a release "cannot waive ... a color-only health state", and
 * MR-18 requires accessibility evidence with every component change. These
 * assertions are that evidence for color: they fail CI if anyone edits a token
 * in a way that drops a real on-screen pairing below threshold.
 *
 * Every pairing below corresponds to something actually rendered:
 * a filled Button, a Chip, a StatusPill icon, a Banner border.
 */
import type {ColorRoles} from '../colorRoles';
import {contrastRatio, CONTRAST_MINIMUM} from '../colorUtils';
import {alarmScheme, darkScheme, lightScheme, statusRolesFor} from '../schemes';

const {normalText, uiComponent} = CONTRAST_MINIMUM;

/**
 * Jest's `expect()` takes no message argument, so `what` is not attached to
 * the assertion directly. It still earns its keep: it names the pairing in
 * `describe.each`'s per-scheme `it()` blocks below, and Jest's own failure
 * output already reports the measured vs. required ratio.
 */
const expectContrast = (
  foreground: string,
  background: string,
  minimum: number,
  /** Unused at runtime; documents the pairing at each call site. */
  _what: string,
) => {
  expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
};

describe.each([
  ['light', lightScheme],
  ['dark', darkScheme],
  ['alarm', alarmScheme],
])('%s scheme meets ACC-005', (name, scheme: ColorRoles) => {
  it('renders body and secondary text legibly on both surfaces', () => {
    expectContrast(scheme.onSurface, scheme.surface, normalText, `${name} body text`);
    expectContrast(
      scheme.onSurfaceVariant,
      scheme.surface,
      normalText,
      `${name} secondary text`,
    );
    expectContrast(
      scheme.onSurface,
      scheme.surfaceContainer,
      normalText,
      `${name} text on card`,
    );
    expectContrast(
      scheme.onSurfaceVariant,
      scheme.surfaceContainerHigh,
      normalText,
      `${name} secondary text on raised card`,
    );
  });

  it('labels every filled button variant legibly', () => {
    expectContrast(scheme.onPrimary, scheme.primary, normalText, `${name} filled Button`);
    expectContrast(
      scheme.onError,
      scheme.error,
      normalText,
      `${name} destructive Button`,
    );
    expectContrast(
      scheme.onPrimaryContainer,
      scheme.primaryContainer,
      normalText,
      `${name} selected Chip`,
    );
    expectContrast(
      scheme.onSecondaryContainer,
      scheme.secondaryContainer,
      normalText,
      `${name} tonal Button (Snooze)`,
    );
  });

  it('labels text and outlined buttons legibly on the surface', () => {
    expectContrast(
      scheme.primary,
      scheme.surface,
      normalText,
      `${name} text/outlined Button label`,
    );
  });

  it('keeps control boundaries visible', () => {
    expectContrast(
      scheme.outline,
      scheme.surface,
      uiComponent,
      `${name} field and chip outline`,
    );
    expectContrast(scheme.focusRing, scheme.surface, uiComponent, `${name} focus ring`);
  });

  it('renders every status icon and label on its own container', () => {
    const status = statusRolesFor(scheme);
    for (const [kind, role] of Object.entries(status)) {
      // StatusPill and Banner draw both the icon and the text in `onContainer`.
      expectContrast(
        role.onContainer,
        role.container,
        normalText,
        `${name} ${kind} status content`,
      );
      // Banner draws its border in `color`, on the app surface.
      expectContrast(
        role.color,
        scheme.surface,
        uiComponent,
        `${name} ${kind} banner border`,
      );
    }
  });
});

describe('the light secondary constraint is asserted, not assumed', () => {
  it('confirms MR-04 amber is a fill/accent color, never light-mode body text', () => {
    // Documents the measured limitation (DL-003) so that if a future palette
    // change makes amber text-safe, this test tells us we may relax the rule.
    const ratio = contrastRatio(lightScheme.secondary, lightScheme.surface);
    expect(ratio).toBeGreaterThanOrEqual(uiComponent);
    expect(ratio).toBeLessThan(normalText);
  });
});
