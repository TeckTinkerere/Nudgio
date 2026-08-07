/**
 * Bridge client contract tests.
 *
 * These exercise the three behaviors MR-08 makes binding: a missing module
 * degrades to a typed error rather than throwing, a contract mismatch is
 * caught before a screen ever sees stale data, and every call normalizes
 * through the same error envelope.
 */
import {ErrorCode} from '../../core/errors';
import {createRecordingLogger} from '../../core/logging';
import {createMediaReminderClient} from '../MediaReminderClient';
import {installMockNativeModule} from '../mockNativeModule';
import {__setNativeMediaReminderOverride} from '../NativeMediaReminder';

const buildClient = (strictContractVersion = false) => {
  const logger = createRecordingLogger();
  let counter = 0;
  return {
    logger,
    client: createMediaReminderClient({
      logger,
      newCorrelationId: () => `corr-${(counter += 1)}`,
      strictContractVersion,
    }),
  };
};

describe('MediaReminderClient', () => {
  afterEach(() => {
    __setNativeMediaReminderOverride(null);
  });

  it('returns a typed bridge-unavailable error when no module is registered', async () => {
    const {client} = buildClient();

    const result = await client.getStartupSnapshot();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.BRIDGE_UNAVAILABLE);
      expect(result.error.retryable).toBe(true);
    }
  });

  it('reports isAvailable() truthfully before and after installing the mock', () => {
    const {client} = buildClient();
    expect(client.isAvailable()).toBe(false);

    const uninstall = installMockNativeModule();
    expect(client.isAvailable()).toBe(true);
    uninstall();
    expect(client.isAvailable()).toBe(false);
  });

  it('resolves a startup snapshot from the mock module', async () => {
    const uninstall = installMockNativeModule();
    const {client} = buildClient();

    const result = await client.getStartupSnapshot();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mediaCount).toBe(0);
      expect(result.value.capability.overall).toBe('ok');
    }
    uninstall();
  });

  it('returns a non-throwing CONTRACT_MISMATCH error when not strict', async () => {
    const uninstall = installMockNativeModule({contractVersion: 999});
    const {client} = buildClient(false);

    const result = await client.getStartupSnapshot();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.CONTRACT_MISMATCH);
    }
    uninstall();
  });

  it('throws a developer error on contract mismatch when strict', async () => {
    const uninstall = installMockNativeModule({contractVersion: 999});
    const {client} = buildClient(true);

    await expect(client.getStartupSnapshot()).rejects.toThrow(/contract mismatch/i);
    uninstall();
  });

  it('lists the three seeded built-in profiles', async () => {
    const uninstall = installMockNativeModule();
    const {client} = buildClient();

    const result = await client.listProfiles();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value.every(profile => profile.isBuiltIn)).toBe(true);
    }
    uninstall();
  });
});
