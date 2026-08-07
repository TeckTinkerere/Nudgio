/**
 * Library screen (MR-03 "Library").
 *
 * Two-column adaptive grid (MR-03: "two-column grid on typical phones and
 * adaptive columns on wider displays" — `useResponsive().mediaGridColumns`
 * already encodes 2/3/4 by width class), search, kind/missing filter chips,
 * category chips and sort, all driving `useMediaList`'s `MediaQuery` so
 * filtering happens once, in the query layer, not scattered across render.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {useMediaList} from './useMediaList';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  MediaCard,
  Screen,
  Stack,
  Text,
  TextField,
  VirtualizedList,
  useResponsive,
} from '../../design-system';
import {
  formatEnglishUnit,
  useTranslation,
  type TranslationKey,
} from '../../localization';
import {mockCategories} from '../../mocks/fixtures';
import type {MediaKind, MediaQuery, MediaSummary, UUID} from '../../native-client/types';
import {formatDurationAccessible, formatDurationCompact} from '../../utils';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type KindFilter = MediaKind | 'missing';

const KIND_FILTERS: readonly {value: KindFilter; labelKey: TranslationKey}[] = [
  {value: 'video', labelKey: 'library.filter.videos'},
  {value: 'audio', labelKey: 'library.filter.audio'},
  {value: 'image', labelKey: 'library.filter.images'},
  {value: 'text', labelKey: 'library.filter.text'},
  {value: 'missing', labelKey: 'library.filter.missing'},
];

const SORTS: readonly {value: NonNullable<MediaQuery['sort']>; labelKey: TranslationKey}[] = [
  {value: 'recent', labelKey: 'library.sort.recentlyAdded'},
  {value: 'name', labelKey: 'library.sort.name'},
  {value: 'mostScheduled', labelKey: 'library.sort.mostScheduled'},
  {value: 'size', labelKey: 'library.sort.fileSize'},
];

const KIND_LABEL_KEY: Record<MediaKind, TranslationKey> = {
  video: 'library.kind.video',
  audio: 'library.kind.audio',
  image: 'library.kind.image',
  text: 'library.kind.text',
};

export function LibraryScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const {mediaGridColumns} = useResponsive();

  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<KindFilter | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<UUID | null>(null);
  const [sort, setSort] = useState<NonNullable<MediaQuery['sort']>>('recent');

  const query = useMemo<MediaQuery>(
    () => ({
      search: search.length > 0 ? search : undefined,
      kinds: activeKind && activeKind !== 'missing' ? [activeKind] : undefined,
      onlyMissing: activeKind === 'missing' ? true : undefined,
      categoryId: activeCategoryId ?? undefined,
      sort,
      offset: 0,
      limit: 100,
    }),
    [search, activeKind, activeCategoryId, sort],
  );

  const media = useMediaList(query);

  const renderItem = useCallback(
    ({item}: {item: MediaSummary}) => (
      <View style={styles.gridCell}>
        <MediaCard
          title={item.title}
          kind={item.kind}
          kindLabel={t(KIND_LABEL_KEY[item.kind])}
          durationLabel={item.durationMs ? formatDurationCompact(item.durationMs) : undefined}
          durationAccessibleLabel={
            item.durationMs ? formatDurationAccessible(item.durationMs, formatEnglishUnit) : undefined
          }
          activeReminderCount={item.activeReminderCount}
          activeReminderCountLabel={
            item.activeReminderCount > 0
              ? `${item.activeReminderCount} active reminder${item.activeReminderCount === 1 ? '' : 's'}`
              : undefined
          }
          isMissing={item.integrity === 'missing'}
          missingLabel={t('library.integrity.missing')}
          onPress={() => navigation.navigate(rootRoutes.mediaDetail, {mediaId: item.id})}
        />
      </View>
    ),
    [navigation, t],
  );

  return (
    <Screen hasAppBar edgeToEdge testID={testIds.library.screen}>
      <Stack gap="xs" paddingHorizontal="md" paddingVertical="sm">
        <Text variant="headlineMedium" isHeading>
          {t('library.title')}
        </Text>

        <TextField
          label={t('library.search.placeholder')}
          value={search}
          onChangeText={setSearch}
          testID={testIds.library.searchField}
        />

        <Stack direction="row" gap="xxs" wrap>
          {KIND_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              label={t(filter.labelKey)}
              selected={activeKind === filter.value}
              onPress={() =>
                setActiveKind(current => (current === filter.value ? null : filter.value))
              }
            />
          ))}
        </Stack>

        {mockCategories.length > 0 ? (
          <Stack direction="row" gap="xxs" wrap>
            {mockCategories.map(category => (
              <Chip
                key={category.id}
                label={category.name}
                selected={activeCategoryId === category.id}
                onPress={() =>
                  setActiveCategoryId(current => (current === category.id ? null : category.id))
                }
              />
            ))}
          </Stack>
        ) : null}

        <Stack direction="row" gap="xxs" wrap>
          {SORTS.map(option => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              selected={sort === option.value}
              onPress={() => setSort(option.value)}
            />
          ))}
        </Stack>
      </Stack>

      {/* `isPending`, not `isLoading` — see TodayScreen for why. */}
      {media.isPending ? (
        <LoadingState label={t('loading.startingUp')} />
      ) : media.isError ? (
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => media.refetch()}}
          diagnosticCode={media.error.correlationId}
        />
      ) : media.data.items.length === 0 ? (
        <EmptyState
          icon="library"
          title={t('today.empty.title')}
          body={t('today.empty.body')}
          action={{label: t('today.empty.importMedia'), onPress: () => undefined}}
        />
      ) : (
        <VirtualizedList
          key={mediaGridColumns}
          testID={testIds.library.grid}
          data={media.data.items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={mediaGridColumns}
          showSeparators={false}
          horizontalPadding="xs"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gridCell: {flex: 1, padding: 4},
});
