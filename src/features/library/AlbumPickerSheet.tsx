/**
 * "Move to": choose an album for the selected items (or albums), shown as
 * albums — a small cover, the name, and where it sits — rather than a list
 * of text buttons. Sub-albums are indented under their parent so the
 * one-level hierarchy reads at a glance. Destinations that would break the
 * nesting rule stay visible but disabled, with the reason in the hint.
 */
import {useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';

import {folderDestinations} from './folderDestinations';
import type {Album} from './libraryAlbums';
import {Button, Icon, Sheet, Text, TextField, VirtualizedList, useTheme} from '../../design-system';
import {useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';

/** Show the search field only once the list is long enough to need it. */
const SEARCH_THRESHOLD = 8;

export interface AlbumPickerSheetProps {
  readonly visible: boolean;
  readonly albums: readonly Album[];
  /** Albums being moved (they and their relatives may be ineligible). */
  readonly movingAlbumIds: ReadonlySet<string>;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onDismiss: () => void;
  /** `null` = Unsorted (for media) or top level (for albums). */
  readonly onConfirm: (destination: string | null) => void;
}

export function AlbumPickerSheet({visible, albums, movingAlbumIds, busy, error, onDismiss, onConfirm}: AlbumPickerSheetProps) {
  const t = useTranslation();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<{readonly id: string | null} | null>(null);

  const movingAlbums = movingAlbumIds.size > 0;
  const byId = new Map(albums.map(album => [album.id as string, album]));
  const eligibility = new Map(folderDestinations(albums, movingAlbumIds, '').map(entry => [entry.id, entry.disabled]));
  const needle = search.trim().toLocaleLowerCase();
  // Parents first, each followed by its own sub-albums.
  const ordered = albums
    .filter(album => album.parentId === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(parent => [parent, ...albums.filter(child => child.parentId === parent.id).sort((a, b) => a.name.localeCompare(b.name))])
    .filter(album => {
      const parent = album.parentId ? byId.get(album.parentId) : undefined;
      return `${parent?.name ?? ''} ${album.name}`.toLocaleLowerCase().includes(needle);
    });

  const styles = StyleSheet.create({
    row: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 56, paddingVertical: theme.spacing.xxs, paddingEnd: theme.spacing.xs, borderRadius: theme.radius.field},
    thumb: {width: 40, height: 40, borderRadius: theme.radius.chip, overflow: 'hidden', backgroundColor: theme.color.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center'},
    indented: {paddingStart: theme.spacing.xl},
    flush: {paddingStart: theme.spacing.xs},
    chosen: {backgroundColor: theme.color.secondaryContainer},
    unavailable: {opacity: 0.4},
    list: {flex: 1, minHeight: 120},
    flex: {flex: 1},
  });

  const row = (key: string, id: string | null, name: string, detail: string, opts: {cover?: Album; icon?: 'inbox' | 'library'; indent?: boolean; disabled?: boolean}) => {
    const isChosen = chosen !== null && chosen.id === id;
    const source = thumbnailImageSource(opts.cover?.covers[0]?.thumbnailToken ?? undefined);
    return (
      <Pressable
        key={key}
        disabled={opts.disabled || busy}
        onPress={() => setChosen({id})}
        accessibilityRole="radio"
        accessibilityState={{selected: isChosen, disabled: opts.disabled}}
        accessibilityLabel={`${name}. ${detail}`}
        style={[
          styles.row,
          opts.indent ? styles.indented : styles.flush,
          isChosen ? styles.chosen : null,
          opts.disabled ? styles.unavailable : null,
        ]}>
        <View style={styles.thumb}>
          {source ? (
            <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Icon name={opts.icon ?? 'album'} size="sm" color={theme.color.onSurfaceVariant} />
          )}
        </View>
        <View style={styles.flex}>
          <Text variant="titleMedium" numberOfLines={1}>{name}</Text>
          <Text variant="bodyMedium" tone="variant" numberOfLines={1}>{detail}</Text>
        </View>
        {isChosen ? <Icon name="check" color={theme.color.primary} /> : null}
      </Pressable>
    );
  };

  const close = () => {
    setChosen(null);
    setSearch('');
    onDismiss();
  };

  return (
    <Sheet visible={visible} title={t('library.albums.moveTo')} closeLabel={t('library.explorer.close')}
      onDismiss={close} scrollable={false}>
      {albums.length > SEARCH_THRESHOLD ? (
        <TextField label={t('library.albums.searchAlbums')} value={search} onChangeText={setSearch} />
      ) : null}
      {movingAlbums ? <Text variant="bodyMedium" tone="variant">{t('library.albums.moveHint')}</Text> : null}
      {error ? <Text variant="bodyMedium" tone="error">{error}</Text> : null}
      {row('root', null,
        movingAlbums ? t('library.albums.topLevel') : t('library.explorer.unsorted'),
        movingAlbums ? t('library.albums.topLevelDetail') : t('library.albums.unsortedDetail'),
        {icon: movingAlbums ? 'library' : 'inbox'})}
      <View style={styles.list}>
        <VirtualizedList
          data={ordered}
          keyExtractor={album => album.id}
          showSeparators={false}
          horizontalPadding={0}
          ListEmptyComponent={<Text variant="bodyMedium" tone="variant">{t('library.explorer.noFoldersFound')}</Text>}
          renderItem={({item: album}) =>
            row(album.id, album.id, album.name, t(album.count === 1 ? 'library.explorer.item' : 'library.explorer.items', {count: album.count}), {
              cover: album,
              indent: album.parentId !== null,
              disabled: eligibility.get(album.id) ?? false,
            })
          }
        />
      </View>
      <Button
        label={t('library.explorer.moveHere')}
        disabled={busy || chosen === null}
        loading={busy}
        onPress={() => {
          if (chosen) {
            onConfirm(chosen.id);
          }
        }}
        fullWidth
      />
    </Sheet>
  );
}
