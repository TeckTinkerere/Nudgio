import {useAppMutation} from './useAppMutation';
import {useAppContainer} from '../app/di';
import {unwrapResult} from '../core/state';
import type {CapabilityKind} from '../native-client/types';

/** MR-06 `open_special_access` action — deep-links to the OS Settings screen for a capability with no (or no longer usable) in-app runtime dialog. */
export const useOpenCapabilitySettings = () => {
  const {repositories} = useAppContainer();

  return useAppMutation<unknown, CapabilityKind>({
    mutationFn: kind => unwrapResult(() => repositories.capability.openSettings(kind)),
  });
};
