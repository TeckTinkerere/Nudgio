export interface DestinationFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string | null;
}

/** A main folder with children cannot be nested without creating a third level. */
export function folderDestinations(
  folders: readonly DestinationFolder[],
  selected: ReadonlySet<string>,
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  return folders.map(folder => {
    const parent = folders.find(item => item.id === folder.parentId);
    const path = parent ? `${parent.name} › ${folder.name}` : folder.name;
    const disabled = selected.has(folder.id)
      || Boolean(folder.parentId && selected.has(folder.parentId))
      || (selected.size > 0 && Boolean(folder.parentId))
      || [...selected].some(id => folders.some(item => item.parentId === id));
    return {...folder, path, disabled};
  }).filter(folder => folder.path.toLocaleLowerCase().includes(needle))
    .sort((a, b) => a.path.localeCompare(b.path));
}
