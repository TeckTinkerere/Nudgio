/**
 * External references shown in-app (About, privacy details).
 *
 * ADR-015: the app makes no network calls, so nothing here is fetched — these
 * are opened via the system browser through an explicit user tap only.
 */
export const links = {
  privacyDetails: 'https://nudgio.mohdaslam.dev/privacy.html',
  sourceRepository: 'https://github.com/TeckTinkerere/Nudgio',
  licenses: 'https://example.invalid/nudgio/licenses',
} as const;
