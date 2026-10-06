import {mockReminders} from '../../../mocks/fixtures';
import {restoreRequestFor} from '../useDeleteReminder';

describe('restoreRequestFor', () => {
  it('saves the deleted reminder again as a new one, with everything the user chose', () => {
    const detail = {...mockReminders[0]!, mediaStartMs: 42_000};
    const request = restoreRequestFor(detail);

    // New: no id or version, so native creates rather than updates a row that is gone.
    expect(request).not.toHaveProperty('id');
    expect(request).not.toHaveProperty('entityVersion');
    expect(request).toEqual({
      mediaId: detail.mediaId,
      label: detail.label,
      notes: detail.notes,
      schedule: detail.schedule,
      profileId: detail.profileId,
      snooze: detail.snooze,
      enabledIntent: detail.enabledIntent,
      historyEnabled: detail.historyEnabled,
      action: detail.action,
      mediaStartMs: 42_000,
    });
  });
});
