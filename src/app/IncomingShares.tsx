/**
 * "Share to Nudgio" (DL-110): imports whatever another app shared in.
 *
 * Drained the way `usePendingMediaOpen` drains its slot — on mount and on
 * every return to the foreground — because a share can cold-start the app
 * before this JS exists to hear an event. Mounted at the shell, not in
 * Library, because the user lands on whichever screen the app last showed.
 *
 * The share is not taken while an import is already running: native holds
 * it, and the check after that import settles picks it up.
 *
 * The progress card floats at the top of the screen, like the in-app due
 * card, with the same Cancel and large-file question every import has.
 */
import {useCallback, useEffect, useRef} from 'react';
import {AppState, View, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useAppContainer} from './di';
import {Dialog, Text, useTheme} from '../design-system';
import {ImportProgress, ImportPrompts} from '../features/library/ImportProgress';
import {importErrorCopy, useImportMedia} from '../hooks';
import {useTranslation} from '../localization';

const overlayStyle: ViewStyle = {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40};

export function IncomingShares() {
  const {repositories} = useAppContainer();
  const importMedia = useImportMedia();
  const t = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const importing = useRef(false);
  importing.current = importMedia.isImporting;
  const start = importMedia.importMedia;

  const check = useCallback(async () => {
    if (importing.current) {
      return;
    }
    const shared = await repositories.media.takeShared();
    if (!shared.ok || shared.value.length === 0) {
      return;
    }
    start({documents: shared.value});
  }, [repositories, start]);

  useEffect(() => {
    // eslint-disable-next-line no-void
    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // eslint-disable-next-line no-void
        void check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  // A share that arrived mid-import is still waiting natively.
  useEffect(() => {
    if (!importMedia.isImporting) {
      // eslint-disable-next-line no-void
      void check();
    }
  }, [importMedia.isImporting, check]);

  const error = importMedia.error && importMedia.error.field !== 'cancelled' ? importMedia.error : null;

  return (
    <>
      {importMedia.isImporting && !importMedia.largeFilePrompt ? (
        <View pointerEvents="box-none" style={overlayStyle}>
          <View
            testID="incoming-share-card"
            style={{
              marginTop: insets.top + theme.spacing.sm,
              marginHorizontal: theme.spacing.md,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
              borderRadius: theme.radius.card,
              backgroundColor: theme.color.surfaceContainerHigh,
              elevation: theme.elevation.level3,
            }}>
            <Text variant="titleMedium">{t('library.import.sharedTitle')}</Text>
            <ImportProgress importMedia={importMedia} />
          </View>
        </View>
      ) : null}
      <ImportPrompts importMedia={importMedia} />
      {error ? (
        <Dialog
          visible
          title={t(importErrorCopy(error).titleKey)}
          body={t(importErrorCopy(error).bodyKey)}
          cancel={{label: t('action.close'), onPress: () => importMedia.reset()}}
        />
      ) : null}
    </>
  );
}
