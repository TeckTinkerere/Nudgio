import {fireEvent, screen, waitFor} from '@testing-library/react-native';
import {Pressable, Text} from 'react-native';

import {ToastProvider} from '../../../app/toast/ToastProvider';
import {createAppError} from '../../../core/errors';
import {err, ok} from '../../../core/result/Result';
import type {GallerySaveSummary, UUID} from '../../../native-client/types';
import {createTestContainer, renderWithProviders} from '../../../testing';
import {describeGallerySave, useLibrarySelection} from '../useLibrarySelection';

const id = (value: string) => value as UUID;

function Probe() {
  const selection = useLibrarySelection();
  const button = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
  return (
    <>
      <Text>{`selected:${selection.selectedIds.size}`}</Text>
      {button('pick a', () => selection.toggleSelected(id('a')))}
      {button('pick b', () => selection.toggleSelected(id('b')))}
      {button('pick c', () => selection.toggleSelected(id('c')))}
      {button('share', () => selection.handleBulkAction('export').catch(() => undefined))}
      {button('share folder', () => selection.handleBulkAction('export', [id('folder-1')]).catch(() => undefined))}
      {button('save', () => selection.handleSaveToGallery().catch(() => undefined))}
      {button('save folder', () => selection.handleSaveToGallery([id('folder-1')]).catch(() => undefined))}
    </>
  );
}

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

const failure = (code: string) =>
  createAppError({code, messageKey: 'error.unexpected', category: 'storage', correlationId: 'test'});

const summary = (overrides: Partial<GallerySaveSummary> = {}): GallerySaveSummary => ({
  status: 'ok',
  savedCount: 0,
  alreadySavedCount: 0,
  failedCount: 0,
  unsupportedCount: 0,
  ...overrides,
});

describe('Library Share', () => {
  it('shares one file on its own without a zip message', async () => {
    const {container, teardown} = setup();
    const share = jest.spyOn(container.repositories.media, 'shareSelection')
      .mockResolvedValue(ok({status: 'ok', affectedCount: 1}));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('share'));

    await waitFor(() => expect(screen.getByText('Opened the share sheet.')).toBeTruthy());
    expect(share).toHaveBeenCalledWith(['a'], []);
    teardown();
  });

  it('says several files go as one zip', async () => {
    const {container, teardown} = setup();
    const share = jest.spyOn(container.repositories.media, 'shareSelection')
      .mockResolvedValue(ok({status: 'ok', affectedCount: 3}));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('pick b'));
    fireEvent.press(screen.getByText('pick c'));
    fireEvent.press(screen.getByText('share'));

    await waitFor(() => expect(screen.getByText('Sharing your selection as one zip.')).toBeTruthy());
    expect(share).toHaveBeenCalledWith(['a', 'b', 'c'], []);
    teardown();
  });

  it('shares a folder with no loose media selected, as a zip', async () => {
    const {container, teardown} = setup();
    const share = jest.spyOn(container.repositories.media, 'shareSelection')
      .mockResolvedValue(ok({status: 'ok', affectedCount: 1}));

    fireEvent.press(screen.getByText('share folder'));

    await waitFor(() => expect(screen.getByText('Sharing your selection as one zip.')).toBeTruthy());
    expect(share).toHaveBeenCalledWith([], ['folder-1']);
    teardown();
  });

  it('asks for a selection instead of calling native with nothing', async () => {
    const {container, teardown} = setup();
    const share = jest.spyOn(container.repositories.media, 'shareSelection');

    fireEvent.press(screen.getByText('share'));

    await waitFor(() => expect(screen.getByText('Select at least one item, or tap Back to exit.')).toBeTruthy());
    expect(share).not.toHaveBeenCalled();
    teardown();
  });

  it('keeps the selection and explains a full phone', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'shareSelection')
      .mockResolvedValue(err(failure('MR_STORAGE_INSUFFICIENT')));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('pick b'));
    fireEvent.press(screen.getByText('share'));

    await waitFor(() => expect(screen.getByText('Not enough free space to prepare the zip to share.')).toBeTruthy());
    expect(screen.getByText('selected:2')).toBeTruthy();
    teardown();
  });

  it('keeps the selection after any other failure', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'shareSelection')
      .mockResolvedValue(err(failure('MR_MEDIA_UNAVAILABLE')));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('share'));

    await waitFor(() => expect(screen.getByText("Couldn't share the selection. Try again.")).toBeTruthy());
    expect(screen.getByText('selected:1')).toBeTruthy();
    teardown();
  });
});

describe('Library Save to gallery', () => {
  it('sends the media and folders and reports what was saved', async () => {
    const {container, teardown} = setup();
    const save = jest.spyOn(container.repositories.media, 'saveSelectionToGallery')
      .mockResolvedValue(ok(summary({savedCount: 4})));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('save folder'));

    await waitFor(() => expect(screen.getByText('Saved 4 to your gallery, in the Nudgio folder.')).toBeTruthy());
    expect(save).toHaveBeenCalledWith(['a'], ['folder-1']);
    teardown();
  });

  it('keeps the selection and explains when the phone cannot save to the gallery', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'saveSelectionToGallery')
      .mockResolvedValue(ok(summary({status: 'limited'})));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('save'));

    await waitFor(() => expect(screen.getByText(/can't save straight to the gallery/)).toBeTruthy());
    expect(screen.getByText('selected:1')).toBeTruthy();
    teardown();
  });

  it('explains a full phone before anything was copied', async () => {
    const {container, teardown} = setup();
    jest.spyOn(container.repositories.media, 'saveSelectionToGallery')
      .mockResolvedValue(err(failure('MR_STORAGE_INSUFFICIENT')));

    fireEvent.press(screen.getByText('pick a'));
    fireEvent.press(screen.getByText('save'));

    await waitFor(() => expect(screen.getByText('Not enough free space to save to the gallery.')).toBeTruthy());
    teardown();
  });
});

describe('describeGallerySave', () => {
  it('reports a clean save', () => {
    expect(describeGallerySave(summary({savedCount: 2, alreadySavedCount: 1}))).toEqual({
      key: 'library.selection.gallery.done',
      params: {count: 2},
      tone: 'success',
    });
  });

  it('reports a repeat save as already there, not as a failure', () => {
    expect(describeGallerySave(summary({alreadySavedCount: 3})).key).toBe('library.selection.gallery.alreadySaved');
  });

  it('reports a partial save with both counts', () => {
    expect(describeGallerySave(summary({savedCount: 2, failedCount: 1}))).toEqual({
      key: 'library.selection.gallery.partial',
      params: {saved: 2, failed: 1},
      tone: 'error',
    });
  });

  it('reports a total failure as an error', () => {
    expect(describeGallerySave(summary({failedCount: 2}))).toEqual({
      key: 'library.selection.gallery.error',
      tone: 'error',
    });
  });

  it('says notes cannot go to the gallery when that is all that was selected', () => {
    expect(describeGallerySave(summary({unsupportedCount: 2})).key).toBe('library.selection.gallery.nothingToSave');
  });

  it('reports a platform without a destination', () => {
    expect(describeGallerySave(summary({status: 'limited'})).key).toBe('library.selection.gallery.unsupported');
  });
});
