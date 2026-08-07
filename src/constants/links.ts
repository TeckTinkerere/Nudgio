/**
 * External references shown in-app (About, privacy details).
 *
 * ADR-015: the app makes no network calls, so nothing here is fetched — these
 * are opened via the system browser through an explicit user tap only.
 */
export const links = {
  privacyDetails: 'https://example.invalid/nudgio/privacy',
  sourceRepository: 'https://example.invalid/nudgio',
  licenses: 'https://example.invalid/nudgio/licenses',
} as const;
