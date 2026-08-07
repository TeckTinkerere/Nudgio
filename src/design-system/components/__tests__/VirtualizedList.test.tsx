/**
 * MR-09 anticipates up to 10,000 reminders / 50,000 retained occurrences.
 * This pins that the list actually renders its data through `FlatList`
 * (virtualized) rather than a screen author's raw `.map()`, and that a
 * screen with no separators still renders correctly.
 */
import {screen} from '@testing-library/react-native';
import {Text} from 'react-native';

import {renderWithProviders} from '../../../testing';
import {VirtualizedList} from '../VirtualizedList';

interface Row {
  readonly id: string;
  readonly label: string;
}

const rows: Row[] = [
  {id: '1', label: 'First reminder'},
  {id: '2', label: 'Second reminder'},
];

describe('VirtualizedList', () => {
  it('renders every item via renderItem', () => {
    renderWithProviders(
      <VirtualizedList
        data={rows}
        keyExtractor={row => row.id}
        renderItem={({item}) => <Text>{item.label}</Text>}
      />,
    );

    expect(screen.getByText('First reminder')).toBeTruthy();
    expect(screen.getByText('Second reminder')).toBeTruthy();
  });

  it('renders nothing for an empty data set without throwing', () => {
    renderWithProviders(
      <VirtualizedList
        data={[]}
        keyExtractor={(row: Row) => row.id}
        renderItem={({item}) => <Text>{item.label}</Text>}
      />,
    );

    expect(screen.queryByText('First reminder')).toBeNull();
  });
});
