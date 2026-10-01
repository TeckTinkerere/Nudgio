import {fireEvent, screen} from '@testing-library/react-native';

import {Text} from '../../../design-system';
import {createTestContainer, renderWithProviders} from '../../../testing';
import {LibraryGridBody, type LibraryGridBodyProps} from '../LibraryGridBody';

function renderGrid(overrides: Partial<LibraryGridBodyProps> = {}) {
  const container = createTestContainer();
  const refetch = jest.fn();
  const props = {
    media: {isPending: false, isError: false, data: {items: [], hasMore: false}, refetch},
    importMedia: {isImporting: false, importMedia: jest.fn()},
    mediaGridColumns: 2,
    renderCard: jest.fn(),
    isFiltered: false,
    onClearFilters: jest.fn(),
    ...overrides,
  } as LibraryGridBodyProps;
  const view = renderWithProviders(<LibraryGridBody {...props} />, {container});
  return {refetch, cleanup: () => {
    view.unmount(); container.queryClient.clear(); container.uninstallNativeModule();
  }};
}

test('keeps folder content visible while importing', () => {
  const view = renderGrid({
    importMedia: {isImporting: true} as LibraryGridBodyProps['importMedia'],
    folders: [{id: 'work', content: <Text>Work documents</Text>}],
  });
  expect(screen.getByText('Work documents')).toBeTruthy();
  view.cleanup();
});

test('a failed refresh retains folder content and offers retry', () => {
  const refetch = jest.fn();
  const view = renderGrid({
    media: {isPending: false, isError: true, data: {items: [], hasMore: false}, refetch,
      error: {correlationId: 'test-refresh'}} as unknown as LibraryGridBodyProps['media'],
    folders: [{id: 'work', content: <Text>Work documents</Text>}],
  });
  expect(screen.getByText('Work documents')).toBeTruthy();
  fireEvent.press(screen.getByText('Retry'));
  expect(refetch).toHaveBeenCalledTimes(1);
  view.cleanup();
});

test('empty-folder import uses the current-folder action', () => {
  const onImport = jest.fn();
  const view = renderGrid({onImport, emptyTitle: 'Empty folder'});
  expect(screen.getByText('Empty folder')).toBeTruthy();
  fireEvent.press(screen.getByText('Import media'));
  expect(onImport).toHaveBeenCalledTimes(1);
  view.cleanup();
});
