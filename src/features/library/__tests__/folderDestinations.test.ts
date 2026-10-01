import {folderDestinations} from '../folderDestinations';

const folders = [
  {id: 'a', name: 'Work'},
  {id: 'b', name: 'Receipts', parentId: 'a'},
  {id: 'c', name: 'Home'},
];

test('search includes the parent path and ignores surrounding spaces', () => {
  expect(folderDestinations(folders, new Set(), ' work ').map(item => item.id)).toEqual(['a', 'b']);
});

test('a folder with children can only move back to the root', () => {
  expect(folderDestinations(folders, new Set(['a']), '').every(item => item.disabled)).toBe(true);
});

test('a subfolder can move into another main folder but never itself or a subfolder', () => {
  const destinations = folderDestinations(folders, new Set(['b']), '');
  expect(destinations.find(item => item.id === 'c')?.disabled).toBe(false);
  expect(destinations.find(item => item.id === 'b')?.disabled).toBe(true);
});
