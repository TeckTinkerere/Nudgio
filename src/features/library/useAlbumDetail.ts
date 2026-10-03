/**
 * The one-line description under an album's name.
 *
 * Lived in `AlbumShelf` until the Library stopped having a separate
 * full-screen album view (DL-089) and that component went with it. The
 * phrasing is shared by every place an album is named — the shelf above a
 * grid, the move picker, the app-bar subtitle — so it stays in one place.
 */
import {useTranslation} from '../../localization';

/** "12 items" or "12 items · 2 albums". */
export const useAlbumDetail = () => {
  const t = useTranslation();
  return (count: number, subAlbums = 0): string => {
    const items = t(count === 1 ? 'library.explorer.item' : 'library.explorer.items', {count});
    if (subAlbums === 0) {
      return items;
    }
    return `${items} · ${t(subAlbums === 1 ? 'library.albums.subCountOne' : 'library.albums.subCount', {count: subAlbums})}`;
  };
};
