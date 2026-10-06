import {fireEvent, screen, waitFor} from '@testing-library/react-native';
import {Pressable, Text} from 'react-native';

import {ToastProvider} from '../../app/toast/ToastProvider';
import {createAppError} from '../../core/errors';
import {err, ok} from '../../core/result/Result';
import {mockMedia} from '../../mocks/fixtures';
import type {ByteCount, PickedDocument} from '../../native-client/types';
import {createTestContainer, renderWithProviders} from '../../testing';
import {importErrorCopy, useImportMedia} from '../useImportMedia';

const picked = (name: string): PickedDocument => ({
  uriToken: `content://picked/${name}`,
  displayName: name,
  mimeType: 'video/mp4',
  sizeBytes: '1000' as ByteCount,
});

const failure = (code: string, field?: string) =>
  createAppError({code, messageKey: 'error.unexpected', category: 'media', correlationId: 'test', field});

function Probe() {
  const importMedia = useImportMedia();
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => importMedia.importMedia()}>
        <Text>Import</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => importMedia.importMedia({documents: [picked('shared.mp4')]})}>
        <Text>Import shared</Text>
      </Pressable>
      {importMedia.largeFilePrompt ? (
        <>
          <Text>{`large:${importMedia.largeFilePrompt.count}`}</Text>
          <Pressable accessibilityRole="button" onPress={importMedia.largeFilePrompt.confirm}>
            <Text>Import anyway</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={importMedia.largeFilePrompt.decline}>
            <Text>Not now</Text>
          </Pressable>
        </>
      ) : null}
      {importMedia.error ? <Text>{`error:${importMedia.error.code}`}</Text> : null}
    </>
  );
}

const large = (name: string): PickedDocument => ({...picked(name), sizeBytes: String(700 * 1024 * 1024) as ByteCount});

const setup = () => {
  const container = createTestContainer();
  const view = renderWithProviders(<ToastProvider><Probe /></ToastProvider>, {container});
  const teardown = () => {
    view.unmount();
    container.queryClient.clear();
    container.uninstallNativeModule();
  };
  return {container, teardown};
};

describe('useImportMedia batches', () => {
  it('keeps going past a file it cannot read and reports the count', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'pickDocuments')
      .mockResolvedValue(ok([picked('a.mp4'), picked('b.mp4'), picked('c.mp4')]));
    const begin = jest.spyOn(container.repositories.media, 'beginImport')
      .mockResolvedValueOnce(ok(mockMedia[0]!))
      .mockResolvedValueOnce(err(failure('MR_MEDIA_UNSUPPORTED_TYPE')))
      .mockResolvedValueOnce(ok(mockMedia[1]!));

    fireEvent.press(screen.getByText('Import'));

    await waitFor(() => expect(screen.getByText('2 imported. 1 could not be added.')).toBeTruthy());
    expect(begin).toHaveBeenCalledTimes(3);
    teardown();
  });

  it('stops the batch when the phone runs out of space', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'pickDocuments')
      .mockResolvedValue(ok([picked('a.mp4'), picked('b.mp4')]));
    const begin = jest.spyOn(container.repositories.media, 'beginImport')
      .mockResolvedValue(err(failure('MR_STORAGE_INSUFFICIENT', 'media_import_storage_insufficient')));

    fireEvent.press(screen.getByText('Import'));

    await waitFor(() => expect(screen.getByText('error:MR_STORAGE_INSUFFICIENT')).toBeTruthy());
    expect(begin).toHaveBeenCalledTimes(1);
    teardown();
  });

  it('treats backing out of the picker as no selection, not an error', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'pickDocuments').mockResolvedValue(ok([]));
    const begin = jest.spyOn(container.repositories.media, 'beginImport');

    fireEvent.press(screen.getByText('Import'));

    await waitFor(() => expect(container.repositories.media.pickDocuments).toHaveBeenCalled());
    expect(begin).not.toHaveBeenCalled();
    expect(screen.queryByText(/^error:/)).toBeNull();
    teardown();
  });
});

describe('useImportMedia large files and shares', () => {
  it('asks before copying a file over 500 MB, and copies nothing when declined', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'pickDocuments').mockResolvedValue(ok([large('big.mp4'), picked('small.mp4')]));
    const begin = jest.spyOn(container.repositories.media, 'beginImport');

    fireEvent.press(screen.getByText('Import'));
    await waitFor(() => expect(screen.getByText('large:1')).toBeTruthy());
    expect(begin).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Not now'));
    await waitFor(() => expect(screen.queryByText('large:1')).toBeNull());
    expect(begin).not.toHaveBeenCalled();
    teardown();
  });

  it('copies the whole batch once the large-file warning is confirmed', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'pickDocuments').mockResolvedValue(ok([large('big.mp4'), picked('small.mp4')]));
    const begin = jest.spyOn(container.repositories.media, 'beginImport')
      .mockResolvedValueOnce(ok(mockMedia[0]!))
      .mockResolvedValueOnce(ok(mockMedia[1]!));

    fireEvent.press(screen.getByText('Import'));
    fireEvent.press(await screen.findByText('Import anyway'));

    await waitFor(() => expect(screen.getByText('2 items imported.')).toBeTruthy());
    expect(begin).toHaveBeenCalledTimes(2);
    teardown();
  });

  it('imports shared files without opening the picker', async () => {
    const {container, teardown} = setup();
    const pick = jest.spyOn(container.repositories.media, 'pickDocuments');
    const begin = jest.spyOn(container.repositories.media, 'beginImport').mockResolvedValue(ok(mockMedia[0]!));

    fireEvent.press(screen.getByText('Import shared'));

    await waitFor(() => expect(screen.getByText('1 item imported.')).toBeTruthy());
    expect(pick).not.toHaveBeenCalled();
    expect(begin).toHaveBeenCalledWith(expect.objectContaining({sourceUri: 'content://picked/shared.mp4'}));
    teardown();
  });
});

describe('importErrorCopy', () => {
  it('does not tell someone to free space for a file that can never fit', () => {
    expect(importErrorCopy(failure('MR_STORAGE_INSUFFICIENT', 'media_import_too_large')).bodyKey)
      .toBe('library.import.errorTooLarge');
    expect(importErrorCopy(failure('MR_STORAGE_INSUFFICIENT', 'media_import_storage_insufficient')).bodyKey)
      .toBe('library.import.errorInsufficientSpace');
  });
});
