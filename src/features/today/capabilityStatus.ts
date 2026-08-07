import type {StatusKind} from '../../design-system';
import type {TranslationKey} from '../../localization';
import type {ResultStatus} from '../../native-client/types';

/** MR-08 `ResultStatus` -> the StatusPill/StatusRoles vocabulary. */
export const statusKindFor = (status: ResultStatus): StatusKind => {
  switch (status) {
    case 'ok':
      return 'ready';
    case 'limited':
      return 'limited';
    case 'needs_action':
      return 'actionNeeded';
  }
};

export const statusLabelKeyFor = (status: ResultStatus): TranslationKey => {
  switch (status) {
    case 'ok':
      return 'today.status.ready';
    case 'limited':
      return 'today.status.limitedTiming';
    case 'needs_action':
      return 'today.status.actionNeeded';
  }
};
