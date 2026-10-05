/**
 * External references shown in-app (About, privacy details).
 *
 * ADR-015: the app makes no network calls, so nothing here is fetched — these
 * are opened via the system browser through an explicit user tap only.
 */
export const links = {
  privacyDetails: 'https://nudgio.mohdaslam.dev/privacy.html',
  sourceRepository: 'https://github.com/TeckTinkerere/Nudgio',
  /**
   * r/Nudgio — where feedback, feature ideas and bug reports go.
   *
   * Separate from `sourceRepository` on purpose: GitHub issues suit a
   * reproducible defect and assume an account most people do not have,
   * whereas "the reminder fired late" or "I wish it could do X" is a
   * conversation. The privacy policy still points removal requests at
   * GitHub, because that is a record-keeping matter rather than feedback.
   */
  community: 'https://www.reddit.com/r/Nudgio/',
  licenses: 'https://example.invalid/nudgio/licenses',
} as const;
