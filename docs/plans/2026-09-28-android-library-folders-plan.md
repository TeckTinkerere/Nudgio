# Nudgio Android — an organised Library

**Date:** 28 September 2026  
**Status:** Proposed implementation plan; no feature implementation or migration performed.  
**Confirmed preference:** Main folders with one level of subfolders.  
**Platform:** Existing Android app, using Ink & Apricot. iPhone implementation and cross-device sync are outside this change.  
**Companion:** [Four-screen concept board](2026-09-28-android-library-folders-board.svg).

## 1. The product idea

Make Library feel like a small personal collection rather than an endless download feed. Someone with five items should still reach their media quickly; someone with five hundred should see meaningful groups before thumbnails.

The organising principle is **one item, one home, many ways to find it**. A file lives in a main folder, a subfolder, or Unsorted. All media and search are views over the same items, not extra copies.

Example:

```text
Library
├── Learning                       main folder
│   ├── Languages                  subfolder
│   ├── Talks                      subfolder
│   └── 6 items directly here
├── Wellbeing
│   ├── Breathing
│   └── Movement
├── Work
├── Family
└── Unsorted                       virtual view, not a real folder
```

Folders reduce visual clutter; they do not reduce the bytes occupied by existing media. The design makes storage understandable without claiming organisation frees space. A real move only changes membership in the database: it does not copy files, alter playback paths or change the reminder's media ID.

### Three possible approaches

| Approach | Strength | Cost | Decision |
|---|---|---|---|
| Single-level albums | Very simple browsing | Cannot reflect the requested main-folder/subfolder grouping | Not selected after user feedback |
| Two-level folders, one home per media item | Familiar Move behaviour, bounded navigation, clear counts and deletion | Needs hierarchy validation and folder-aware search/backup | **Recommended and used throughout this plan** |
| Multi-album collections and tags | One item can belong to several collections | “Move” versus “Add” becomes ambiguous; counts and deletion are harder to explain | Defer; do not introduce silently |

Depth is exactly `Library → main folder → subfolder`. Library is not counted as a folder level. A subfolder cannot contain another folder. Both a main folder and a subfolder may hold media directly.

### Outcomes to measure

- In observed usability sessions, at least 8/10 participants find a named item inside a subfolder within 15 seconds and organise five items within 45 seconds, without coaching.
- At least 9/10 correctly understand that removing a folder keeps its media, and that All media is not another copy.
- At least 8/10 can return from a global search result to its containing folder without getting lost.
- All matching items remain reachable beyond the current 100-item first page.
- No folder operation loses media, changes active reminders or starts media playback.
- Measure in local test sessions; add no analytics SDK.

## 2. What the current repository actually supports

These are source observations, not a claim about an installed APK.

| Current source | Observation | Planning implication |
|---|---|---|
| `src/features/library/LibraryScreen.tsx` | Search, media-kind filters, sort and responsive two-pane display already exist. It requests `offset: 0, limit: 100`. | Preserve the useful controls; implement real pagination instead of another view capped at 100. |
| `LibraryGridBody.tsx`, `src/hooks/useMediaList.ts` | Virtualized rendering exists, but the current hook supplies one page and the grid has no next-page handling. | Rendering virtualization alone does not make all records reachable. |
| `useLibrarySelection.ts`, `LibrarySelectionHeader.tsx` | Selection, export and delete exist. Bulk deletion invokes `cascadeDeleteReminders: true` for each selected ID. | Add Move to the toolbar; add an explicit dependency confirmation before reusing bulk Delete in the new experience. |
| `src/features/reminders/SelectMediaScreen.tsx` | The reminder attachment picker shares Library visuals, but also requests only the first 100 items. | Folder browsing/search must reach this picker too. |
| `MediaAssetEntity.kt`, `MediaQuerySql.kt` | Nullable `category_id` and category filtering exist; no backing category table or assignment UI. Import writes null. | Do not pretend the existing category field is an implemented folder model. |
| `MediaReminderDatabase.kt` | Current database version is 5. | Propose additive migration 5→6 if that remains the current version at implementation time. |
| `MediaQuerySql.kt` | Search checks title/notes with escaped SQL LIKE; sorting uses stable ID tie-breaks; native page limit is 200. | Keep bound queries and deterministic ordering; add explicit folder scopes and Unicode search tests. |
| `MediaImporter.kt` / `useImportMedia.ts` | Import is a single-file operation with no folder destination. | Carry a destination through native import; do not assume multi-import or deduplication already works. |
| `BackupExporter.kt:97–119` | Full backup currently writes empty media/category arrays and zero media bytes/counts. | Full media-plus-folder backup is a real dependency, not a small “add folders to JSON” task. |
| `BackupSemanticValidator.kt:83–90` | Media/category entries are checksum-checked but not restored as a complete logical media graph. | Build and prove media/folder restore before declaring organised libraries portable. |

Existing specifications require Room as the source of truth, opaque private filenames, validated logical backups, safe deletion and native alarm independence. Some source comments describe earlier development states; use executable paths and fixtures as evidence.

## 3. The new Library home

### Layout

```text
Library                                  +     ⋮
[ Search folders and media                    ]
[ Folders                         All media   ]

[ Unsorted · 18 ]        [ Used in reminders ]

PINNED
[ Languages                          12 items ]
  Learning › Languages

YOUR FOLDERS                              Sort
┌────────────────┐  ┌────────────────┐
│ soft cover     │  │ soft cover     │
│ Learning       │  │ Wellbeing      │
│ 32 items       │  │ 24 items       │
│ 2 subfolders ⋮ │  │ 2 subfolders ⋮ │
└────────────────┘  └────────────────┘
┌────────────────┐  ┌────────────────┐
│ Work           │  │ Family         │
│ 16 items       │  │ 8 items        │
└────────────────┘  └────────────────┘

Today       Reminders       Library       Settings
```

Retain the existing Android bottom navigation rather than importing the iPhone three-tab design. Library defaults to Folders; All media is one tap away. Store the last root tab locally as a view preference, with Folders the initial default.

### Quick views

- **Unsorted:** Every asset with no folder membership. Its count is the total, not the loaded page count. It cannot be renamed, removed, pinned or used as a folder parent.
- **Used in reminders:** Assets referenced by at least one non-deleted reminder, including paused reminders. Show active versus paused status in item details; do not use active-only counts to imply an item is safe to delete.
- **All media:** The complete paginated collection regardless of folder. It is a view, never a second storage location.
- **Needs attention:** Preserve the current integrity filter for missing/changed/unsupported media in the media Filters sheet. Do not add a permanent warning chip when there is nothing to repair.

Avoid a horizontal carousel containing every folder: it hides most choices and does not solve scaling. Use a vertical grid/list with real pagination.

### Folder card design

- A compact album-like card: two subtly offset rounded sheets, a short folder tab and up to three cropped thumbnail previews. Shadows are restrained; no animated 3D or glossy glass.
- Default card uses a paper surface, ink text and an apricot tab. Optional icon/colour presets remain within Ink & Apricot and accessible neutral variations; no arbitrary colour picker in the first release.
- For audio/text, show a clean waveform/text glyph. Missing thumbnails use an intentional fallback, not a broken image.
- Name occupies up to two lines; visible total item count includes descendants. A separate line says “2 subfolders” when applicable. Accessibility announces the full name and count.
- A main card may show descendant media in its preview; its detail screen clearly separates subfolders from direct media. Select the first three assets by stable `created_at, id` order across the subtree, returning at most three thumbnail tokens; never decode original files for folder covers. Imports do not constantly reshuffle existing covers; removal/move of a represented item updates its cover.
- Empty folders have a calm folder illustration. They remain visible and searchable.
- Overflow menu has a 48dp target. Folder open and overflow are separate accessible actions, without overlapping hit regions.
- Typical phones use two columns; compact or large-text layouts use one. Wider windows adapt with the existing responsive system.

## 4. Inside a folder

```text
‹ Library                 Learning         ⋮
32 items · 2 subfolders
[ Search Learning                             ]

SUBFOLDERS
[ Languages · 12 ]      [ Talks · 14 ]

IN THIS FOLDER                         Select
[ All types ]                           Filter
[ 6 direct media items, paginated as needed ]

                         + Add here
```

- Browse mode shows immediate subfolders and directly contained media. It does not repeat every descendant item beneath its subfolder cards.
- Folder total is recursive; the direct-media section states its own count. Example: 32 total = 12 Languages + 14 Talks + 6 directly in Learning.
- On a subfolder screen, show a breadcrumb `Library › Learning › Languages` and no New subfolder action.
- At small widths, show the immediate parent as Back and expose the full breadcrumb through the location row. Do not cram three long names into a single toolbar line.
- Add here opens a sheet with **Import photos/video**, **Import audio/file** and, at main-folder depth only, **New subfolder**. All new imports inherit this destination.
- A main folder may contain both subfolders and direct media; neither has to be empty before the other can be used.
- Back preserves parent query, filter, sort and scroll anchor. Android Back first closes keyboard/sheets or exits selection, then navigates up.
- Existing landscape/tablet detail pane remains available; hierarchy is in the content pane and media detail stays on the right. Do not invent a dense three-pane layout for phones.

### Empty and failure states

| State | Message and useful action |
|---|---|
| No folders yet, existing media | “Give your Library a little order.” Create folder; “Your 98 items are safe in Unsorted.” |
| Entirely empty app | “A place for what matters.” Import media; secondary Create folder. |
| Empty main folder | “Start this collection.” Add media / New subfolder. |
| Empty subfolder | “Nothing here yet.” Import here / Move existing media here. |
| No scoped search result | “No matches in Learning.” Clear filters / Search all Library. |
| Folder removed while open | Navigate to its surviving parent or Library and announce “This folder was removed. Your media is still available.” |
| Database/read failure | Retry with an error state; never show empty-success copy. |
| Next-page failure | Keep loaded results and show a Retry footer. |

## 5. Create, rename, pin and rearrange

### Create

1. Tap Library + → New folder, or Add here → New subfolder inside a main folder.
2. A bottom sheet shows name, location, optional icon and a small set of brand-safe colour accents. Location is explicit: “In Library” or “In Learning.”
3. Name autofocuses. Save stays disabled with a visible explanation if invalid.
4. On success, enter the empty folder and offer Import here and Move existing media here. Creation alone never imports or moves anything.

Name rules: 1–60 Unicode code points after trimming; normalize to NFC, collapse repeated whitespace for the comparison key, and use locale-independent lowercase. Preserve display spelling. Reject blank/control-only names, path separators and reserved dot-only names; do not treat a name as a path. Accents remain significant. Sibling comparison keys must be unique; identical names in different parents are allowed. Show a field error such as “A folder named Languages already exists here.” Test Tamil, Arabic, emoji, combining characters and Turkish casing explicitly.

### Rename and appearance

Folder menu: Rename, Change appearance, Pin/Unpin, Move folder, Remove folder. Save by stable folder ID, not path. Renaming a main folder changes displayed descendant paths without rewriting any media file or reminder.

### Pinning

Allow up to eight pinned folder shortcuts. A subfolder pin includes its parent path. Pins are shortcuts, not additional membership. A pinned main folder appears in Pinned rather than duplicating its card in the root unpinned section. A pinned subfolder remains a normal child when browsing its parent. Pinned order is deterministic by pin time; drag reordering is deferred.

### Moving folders

- A subfolder can move to another main folder or be promoted to Library.
- A main folder with no children can move under another main folder.
- A main folder with children cannot be placed under another folder, because that would create a third level. Explain: “Move its subfolders first, or keep this folder in Library.”
- No self-parenting, cycles, duplicate sibling names or destinations that disappeared during the operation.
- Folder relocation preserves all media memberships and IDs. Show a confirmation containing the destination path and affected item/subfolder counts.
- No drag-and-drop requirement; use an explicit Move folder action accessible by touch, keyboard and TalkBack.

## 6. Moving media: the central interaction

### Single item

Media detail gains a **Location** row such as `Learning › Languages`, with **Move** beside it. The same action is available from the item menu. Choosing a folder here opens its location; Move opens the destination picker.

### Multiple items

1. Tap Select, then check media cards. Long press may be a shortcut, but is never the only entry.
2. Contextual toolbar reads “3 selected” with **Move**, Export and a clearly secondary Delete action. At narrow widths, secondary actions move to a menu rather than shrinking targets.
3. Tap Move to open a full-height destination sheet.
4. Browse or search folder names, open a main folder to choose a subfolder, or use New folder in the picker.
5. Tap the explicit **Move here** footer; tapping a folder row navigates and never commits immediately.
6. After native confirmation: “3 items moved to Learning › Languages.” Offer Undo and View folder. Remain in the source location by default, preserving scroll near remaining items.

```text
Move 3 items                              Cancel
[ Find a folder                                ]
Library › Learning

○ This folder · Learning
  Languages                               ›
  Talks                                   ›
  + New subfolder

Destination: Learning › Languages
[                Move here                    ]
```

Picker rules:

- Root destination **Unsorted** removes folder membership. Label the result “Moved to Unsorted,” not deleted.
- Search displays full paths to distinguish repeated subfolder names.
- A source folder remains browseable to reach its children. A destination already containing every selected item makes the commit button inactive with “Already here.” Mixed-source moves report actual moved and already-here counts.
- Use a selection cap of 200 per atomic move initially, aligned with bounded bridge/database work. Explain the cap when reached. Select loaded items acts only on loaded rows; there is no misleading “Select all” that ignores unloaded results. Unlimited “all matching” selection is deferred.
- A change of folder/search/filter exits selection only after confirmation when something is selected. The destination sheet carries an explicit snapshot of IDs; scrolling/pagination does not silently change selection.
- Do not allow concurrent move commands from repeated taps. Keep selection and destination on failure; show a precise recoverable error.
- If an item or destination changes/deletes after opening the sheet, reject the stale command atomically and offer Refresh. No unexplained partial moves.

### Undo

Undo covers media moves, including batches with different original folders. Persist a bounded operation receipt containing IDs, previous memberships and post-move versions; names/notes do not enter logs. Keep one most-recent undoable move for ten minutes. Show a snackbar with accessible timeout and expose “Undo last move” in Library's menu for the remainder of that window.

Undo is a conditional native transaction: every affected item's post-move version and original destination must still match the receipt. If an item has been edited, moved/deleted again, or an original folder no longer exists, do not overwrite newer work; return “These items changed since the move. Choose their location again.” No partial rollback. Expiry after ten minutes is explicit; cleanup happens on subsequent commands/startup, not a background timer.

Folder removal is confirmed separately and has no promised Undo in this release. Folder rename/reparent can be reversed manually through the same controls.

## 7. Search that always explains its scope

| Context | Default scope | Search behaviour |
|---|---|---|
| Library root | Entire Library | Folder names and media titles/notes; grouped results with Folders and Media sections. |
| Main folder | Current folder plus its subfolders | Matching child folder names and matching media within the subtree. Show “Including subfolders” chip, which can switch to “This folder only.” |
| Subfolder | Current subfolder | Matching media titles/notes only. |
| Move picker | All valid destination folders | Folder names and full location paths; never media results. |
| Reminder attachment picker | Current location or All Library | Same folder/media query semantics; only media can be selected. |

Global search example for “language”:

```text
Search Library
[ language                               × ]
[ All results ]   [ Folders ]   [ Media ]

FOLDERS · 2
Languages                     Learning · 12 items
Languages                     Work · 4 items

MEDIA · 7
Spanish phrases               Learning › Languages
Language warm-up              Unsorted
```

Detailed rules:

- Folder results match folder names; media results match media title/notes. Searching a folder name does not dump every media item in that folder into the media result section.
- Rank folders by exact match, then prefix, then substring, with deterministic name/ID tie-breaks. Media preserves the selected sort, with ID as final tie-breaker. Do not imply AI relevance.
- Search is case-insensitive under the defined normalization policy, with literal `%`, `_` and backslash handling. Query length is capped at 120 code points. Debounce typing by approximately 200ms; submit immediately on keyboard Search.
- Cache keys include query, scope, descendant flag, type filter, sort and page. Late responses from a previous query must never replace the current query's results.
- Main-folder browse shows direct media; its search deliberately widens to descendants, with the scope chip always visible. Clearing search returns to the original browse position.
- A global media result shows its folder breadcrumb and offers Open location in detail. Back returns to the preserved search and scroll state.
- Root search can filter Folders or Media. Media-kind filters refine only media, not folder counts. A filter summary makes this explicit.
- Folder search is not full-text search inside audio/video, OCR, filename crawling or cloud search. These remain outside scope.
- Empty query returns browse; empty results have scope-specific copy and an explicit Search all Library action. Never widen scope silently.

## 8. Import and the reminder attachment picker

### Import placement

- Import from Library root/All media/Today defaults to Unsorted.
- Import from a real folder defaults to that folder, captured at picker launch even if the user navigates elsewhere while copying.
- Native request carries `destinationFolderId` and an idempotency key through import journaling and recovery. Commit media row and membership together; do not rely on a second JS “move after import” call.
- If the destination is removed while a file is being copied, preserve the successfully imported asset in Unsorted and return a typed `destinationRemoved` warning. Show “Imported to Unsorted because that folder was removed.” Never lose a valid import or silently claim it landed in the original folder.
- Cancellation/storage failure leaves no completed normal asset or dangling membership; existing file cleanup/journal contracts continue to apply.
- Importing a duplicate is not moving an existing item. Do not add automatic duplicate reassignment. Current duplicate-handling behaviour must be measured and preserved unless separately specified; existing same-hash records retain their folder independently.

### Choosing media for a reminder

`SelectMediaScreen` uses the same browsing/query components in a **picker mode**. It supports folder navigation, global and scoped search, full pagination, preview and Use this media. Hide folder-management/bulk-delete controls there; editing a reminder should not unexpectedly reorganise the Library.

The editor retains its unsaved draft and selected media ID when entering/backing out. Renaming or moving the attached asset changes the location label only. Existing reminders keep working because their media reference never changes.

## 9. Safe removal and deletion

**Remove folder** removes organisation; **Delete media** removes content. Keep those verbs distinct throughout the app.

| Operation | Result |
|---|---|
| Remove empty main folder | Remove that folder. |
| Remove a subfolder | Move its direct media to its parent, then remove the subfolder in one transaction. |
| Remove a main folder with media/children | Move all its own and descendant media to Unsorted; remove its subfolders and pins; remove the main folder atomically. |
| Delete actual media | Use an explicit media-dependency confirmation; folder membership/cover references clean up with the asset. |

Confirmation example: “Remove Learning and its 2 subfolders? Your 32 items will move to Unsorted. Existing reminders will keep their media.” The button says **Remove folder**, with Cancel beside it. Never offer an ambiguous combined “delete everything” checkbox in this dialog.

Before exposing current bulk Delete in the revised toolbar, add a native dependency summary of all affected reminders, not just active ones. The user must explicitly choose the supported dependent-reminder policy; do not silently pass `cascadeDeleteReminders: true`. Folder work never invokes the media deletion path. Missing/corrupt media can still be organised; moving does not repair the bytes.

## 10. Durable model and native ownership

### Chosen structure

Use additive Room tables with a **single-membership table**, rather than repurposing the unimplemented category column or rebuilding the media table immediately.

| Table | Fields and invariants |
|---|---|
| `media_folders` | `id` UUID PK; nullable `parent_id` FK to folders; `name`; `normalized_name`; non-null `sibling_scope`; `icon_key`; `accent_key`; nullable `pinned_at`; creation/update timestamps; `entity_version`. |
| `media_folder_memberships` | `media_id` PK/FK to media assets; non-null `folder_id` FK to folders; membership timestamp. Primary key ensures one folder per asset. Absence of a row means Unsorted. |
| `library_state` | Singleton with `content_revision` and `structure_revision`, incremented transactionally by relevant mutations. Used to invalidate paginated reads and stale folder/destination previews. |
| `library_move_receipts` | Dedicated bounded idempotency results and conditional Undo receipts, described below. No content labels in diagnostic exports. |

Proposed first implementation: a dedicated `library_move_receipts` table with request ID, typed before/after membership/version payload for at most 200 IDs, creation/expiry and undo-consumed marker. Retain at most 32 idempotency results for 24 hours; only the latest eligible move is exposed for Undo for ten minutes. Bounded cleanup on startup/mutation, never periodic wake work. Evicted/expired request IDs require refreshed state rather than replaying a guessed result.

Foreign-key behaviour:

- Membership → media: CASCADE on actual media deletion.
- Membership → folder: RESTRICT; removing a folder must deliberately rehome memberships first.
- Folder → parent: RESTRICT; removing a tree is an explicit ordered transaction, not a hidden cascade of content.
- No folder ID is a filesystem directory, URI, reminder ID or storage key.

Use a unique index on `(sibling_scope, normalized_name)`, with a consistency constraint making `sibling_scope` equal to parent ID or a reserved root sentinel. Do not rely on a nullable parent in a uniqueness constraint to prevent duplicate root names. Native service plus schema triggers/checks enforce two-level depth and acyclicity on insert/reparent; migration tests verify raw SQL cannot insert third-level/cyclic graphs. Reparenting a main folder with children must be rejected even if its new parent is valid.

Keep `category_id` unchanged as deprecated, non-authoritative legacy metadata for this migration. It does not control folder membership. New imports continue to leave it null. Do not fabricate folder names from unexplained historical IDs or silently drop non-null legacy values. Record this deviation from MR-09's earlier category plan in a proposed ADR and update related comments/contracts during implementation.

### Move transaction

1. Validate request ID, 1–200 unique media IDs, expected entity versions, expected structure revision and destination.
2. Begin one Room write transaction. Re-read existence/version/depth and perform all checks before any membership mutation.
3. Update memberships; remove a membership for Unsorted. Keep `media.id`, storage key, checksum, thumbnail token and reminder references unchanged.
4. Increment changed assets' entity versions and Library content revision; preserve asset `created_at`, so Recently added does not become Recently moved.
5. Persist idempotency result and Undo receipt in the same transaction.
6. Commit once, then publish an organisation-change event. An interrupted transaction applies all changes or none; a lost response is recovered by request ID.
7. Invalidate folder counts/covers, media lists/detail locations, search and picker queries. Do not reschedule alarms or alter scheduler generations for folder-only mutations.

All mutation entry points share this service: bridge, import finalisation and restore. React state is a cache, never the durable membership authority.

## 11. Queries, paging and performance

- Build folder-aware SQL in pure query builders, keeping raw values bound. Queries must distinguish `all`, `unsorted`, `folder-direct` and `folder-subtree`; missing scope must not accidentally mean Unsorted.
- Main-folder subtree requires only the folder and its immediate children; arbitrary recursive traversal is unnecessary at depth two.
- Index membership by folder/media ID, folder parent/name, and supported media sort/filter keys. Use batched counts and cover selection; avoid one query per card and one media-detail request per thumbnail.
- Folder counts include all descendant assets exactly once. Cache counts by content revision, or compute with grouped queries; never persist a counter without a transactionally maintained source.
- Start with native pages of 50 media / 24 folders, bounded at current native maximum 200. Response includes total, hasMore and Library content revision. Offset paging remains acceptable only with revision checking: on a changed revision, discard accumulated pages and refresh from the start, rather than merging incompatible snapshots. Preserve a visible ID anchor where possible.
- The query's count and page read come from the same Room read transaction. All media mutations, including import/delete/title changes affecting sort/search, advance the revision. Folder structure/presentation edits advance structure revision too.
- Native equality/rank/search normalization is authoritative. Do not assume SQLite's basic NOCASE gives complete Unicode folding. Add `search_title` and `search_notes` text columns to media assets with safe initial defaults, then backfill normalized values in the migration. These additive columns leave existing primary keys, storage keys and file bytes intact. Import, edit and restore update them in the same transaction as display metadata. Folder search uses `normalized_name`. Use the same normalization policy in the Kotlin query builder; do not strip meaningful marks from Tamil/Arabic by indiscriminate accent removal.
- Preserve title/notes substring search in the first implementation, with bounded result pages and debouncing. Profile before choosing an FTS migration; FTS should not silently change substring matching or language behaviour.
- Use virtualized section/grid rendering. Move headers and filters into scrolling content where useful; prevent a tall fixed filter stack from hiding the media at large font sizes.
- Generate/read only bounded thumbnails from the existing cache. Organising never decodes, rehashes or recopies original media.

Proposed measured budgets on a named reference Android device: first folder/media page p95 ≤250ms warm / ≤600ms cold for 10,000 synthetic media records and 500 folders; search p95 ≤300ms after debounce; 200-item metadata move p95 ≤500ms excluding animation. Capture query plans and memory with/without thumbnails. These are acceptance targets, not measured claims. Reconcile with stricter existing MR-15 budgets before implementation. No app-owned idle wakeups or periodic folder scan.

Use generous initial product bounds of 500 total folders, at most two levels and eight pinned shortcuts, clearly reported at creation/import validation. Revisit bounds using device evidence rather than allocating an unlimited tree in JS.

## 12. Contract and source changes

Proposed native methods/DTOs, finalized against React Native Codegen before implementation:

| Contract | Purpose |
|---|---|
| `listFolders(query)` | Paged immediate children or folder-search results; totals, breadcrumbs, bounded cover tokens, revision. |
| `getFolder(id)` | Folder metadata, parent path, direct/recursive counts and version. |
| `saveFolder(request)` | Create/rename/presentation/pin changes with validation and expected version. |
| `moveFolder(request)` | Reparent/promote with structure revision and depth checks. |
| `inspectFolderRemoval(id)` / `removeFolder(request)` | Typed count/destination preview and confirmed atomic rehome/remove. |
| `moveMedia(request)` / `undoMediaMove(requestId)` | Atomic single/batch moves, native idempotency and conditional Undo. |
| Extended `listMedia(query)` | Explicit scope, descendant flag, revision-aware page response and location. |
| Extended `beginMediaImport(request)` | Destination folder captured durably; explicit removed-destination result. |
| `getMediaDeletionImpact(ids)` | Accurate referenced-reminder summary before destructive deletion. |

Use Codegen-compatible wire shapes declared in the native spec; translate domain discriminated unions in the client. New native error cases cover invalid folder name, duplicate sibling, depth exceeded, folder missing, stale selection, selection limit and expired Undo. Preserve real I/O/storage errors rather than converting everything to validation failure.

Expected source work:

| Area | Existing touchpoints / new units |
|---|---|
| Screens | `LibraryScreen.tsx`, `LibraryGridBody.tsx`, `LibrarySelectionHeader.tsx`, `useLibrarySelection.ts`, `MediaDetailContent.tsx`, `SelectMediaScreen.tsx`. |
| Shared browsing | Extract a focused `MediaBrowser` and folder-aware query/view model usable in browse/pick modes; no broad navigation rewrite. |
| New presentational pieces | `FolderCard`, `FolderBreadcrumb`, `FolderLocationRow`, `FolderEditorSheet`, `MoveDestinationSheet`, grouped search results. Keep data commands outside visual components. |
| Query/cache | `src/hooks/useMediaList.ts`, new paged folder/media hooks, `queryKeys.ts`, native change subscriptions. |
| Contracts | `NativeMediaReminder.ts`, `types.ts`, `mapping.ts`, `MediaReminderClient.ts`, repositories and test fakes. |
| Kotlin | New folder entity/DAO/query/service units; `MediaQuerySql.kt`, `MediaLibraryService.kt`, `MediaDtoWriter.kt`, `MediaImporter.kt`, bridge registration and Room migrations. |
| Backup | Exporter/importer, records, manifest, semantic/structural validation, conflict planning and recovery. |
| UX support | Navigation types/routes, localization dictionaries/test IDs, design tokens only if a reusable folder role is needed. |

The proposed changes require updates to MR-03/04/05/08/09/10/11/13/14/15/17/21 and the implementation decision log. Keep Android architecture intact; no new network, broad gallery, battery or background component is justified by folders.

## 13. Upgrade and backup: a release dependency

### Database upgrade

Propose schema 5→6, rebased if another migration lands first. Create folder/membership/state/receipt tables and normalized search values with all required indices/constraints. Every existing asset starts in Unsorted because no valid folder membership exists. Preserve IDs, opaque storage keys, hashes, notes, reminders, active alarm sessions and scheduler state. No destructive fallback, file relocation or whole-media rehash.

Test the full supported migration chain, not just an empty 5→6 database. Include existing alarms, duplicate names across old metadata, non-null orphan category IDs, missing thumbnails/media and many items. Export and retain Room schemas, and run invariant tests with real on-disk fixtures. Google's [Room migration guidance](https://developer.android.com/training/data-storage/room/migrating-db-versions) supports retaining schema history and testing migration paths; use the repository's pinned Room version rather than upgrading it just because documentation has newer examples.

### Archive version decision

Propose **Android archive 2.0, minimum reader 2.0**. This is deliberately a major version: folders plus real media restore are essential organisation data, and the current reader ignores media/category record contents. Do not disguise the new graph as an optional extension that old readers could silently discard.

- Export `data/folders.json` with ID, parent ID, name, icon/accent, pin order and timestamps. No computed counts/covers, normalized search cache, receipts or local absolute paths.
- Media records carry `folderId` or null, with bytes and checksums represented by the logical media format. Keep opaque archive filenames independent of folder names.
- Restore the folder graph first, then media/membership, then dependent reminder data in a validated recovery procedure. Validate depth, cycles, parent references, names, uniqueness, counts, bounds and every media reference before mutation.
- New export/import must handle actual media streaming, checksums, storage reserve and rollback. The current empty-media full-backup implementation must be completed or replaced in this workstream; otherwise **do not release folders as fully backed up**.
- Old 1.0 archives remain inspectable through a separate versioned reader. They cannot recreate bytes they never contained. Allow restore only when required media references can be resolved safely under the selected mode; unresolved media blocks mutation with clear missing-media copy. Never invent file content or silently erase current media on Replace.
- Old app/new 2.0 archive must refuse mutation as incompatible. Test against the actual older reader, not just a mocked version comparison.
- Replace must restore all folders/media or recover the old Library; never a mixture. Restored reminders follow existing capability re-evaluation policy.
- Merge keeps existing items in their existing folders unless the user explicitly chooses otherwise. Incoming ID conflicts map to new IDs and rewrite parent/membership references; no merge by name alone. Conflicting sibling names get deterministic, previewed “(imported)” suffixes within length bounds. Existing content is never relocated because an archive says so. Same-hash files do not automatically collapse distinct logical media records.
- Export selected media remains a file-sharing action; it does not promise to preserve folder structure. Whole-library backup is the structure-preserving route. Folder-as-shareable-ZIP is deferred.

Maintain existing archive entry/size/compression/stream limits, file journals and restore tokens. Folder names are private metadata in backups and must be covered by the existing plaintext-export disclosure. SQLite [foreign-key constraints](https://www.sqlite.org/foreignkeys.html) support referential enforcement, but do not replace application hierarchy/restore validation.

## 14. Design details that make this feel considered

1. **Unsorted as a gentle inbox.** Show “18 items to organise,” never a red badge or guilt-inducing completion score. Its Organise action enters selection; it does not classify private media automatically.
2. **Recognisable collection covers.** Three thumbnail peeks, a small icon and an apricot folder tab make a collection easier to recognise than an identical grid of folder glyphs. Stable covers avoid visual reshuffling on every app open.
3. **Location everywhere it helps.** Breadcrumbs in search and media detail answer “Where did I put this?” without opening a second management screen.
4. **Import into context.** “Add to Languages” is more useful than importing everything into a giant root feed and asking the user to clean it later.
5. **A reassuring move.** Brief 150–180ms fade/settle after confirmed mutation, then Undo. No flying-card spectacle, fake transfer progress or haptic loop for a metadata update. Reduced-motion mode is immediate.
6. **Folder templates as suggestions, not clutter.** First-use name suggestions such as Learning, Wellbeing and Work are optional chips; tapping pre-fills the name only. Never create empty folders without consent.
7. **Storage in the right place.** Folder details can show total bytes from metadata, labelled “Media size.” Explain that this is not free-space savings and may include known missing-file records until integrity is refreshed; no disk scan on every folder tap.

### Brand, accessibility and device behaviour

Use the existing tokens: ink blue `#2D4DB5`, apricot `#E9B58E`, ivory `#F7F4EE`, paper `#FFFEFA`; dark roles use midnight/moon-blue equivalents already defined. Selection/focus is blue. Apricot is decorative or uses its approved dark label pairing, never white small text or the sole selected-state cue. Respect existing optional Material You behaviour.

All essential actions have 48dp targets and visible names. At 200% text, switch folder cards and toolbars to readable rows/menus. TalkBack announces name, full path, total count and selection state; thumbnail collages are decorative. Do not require colour, dragging, swiping or long press to manage media. On move completion, announce outcome once and put focus on Undo or the surviving list position appropriately. RTL uses start/end spacing and mirrored navigation, while logical paths remain unambiguous. Folder names and translations are not concatenated into inaccessible control labels.

## 15. Ordered implementation packages

| Package | Deliverable | Required evidence / exit |
|---|---|---|
| F0 — Design and compatibility contract | Review this plan, propose folder/backup ADR, amend affected specs, freeze name/depth/delete/search semantics. Audit current backup path with a real synthetic export. | Written decisions and observed archive fixture; no unlabelled assumption about media backup. |
| F1 — Durable organisation | Additive Room migration, folders/memberships, constraints, state revisions, read queries and counts. | Migration chain + FK/depth/uniqueness/query tests; unchanged media/reminder/file invariants. |
| F2 — Native mutations | Create/rename/pin/reparent/remove, atomic moves, bounded receipts, Undo, deletion-impact query. | Failure/retry/concurrency tests; no scheduler or file-byte mutation on organisation. |
| F3 — Contracts and paged browsing | Codegen/client/repositories, explicit scopes, native search, revision-aware paging and events. | Android Codegen compilation; results beyond 100; stable cache/scope transitions. |
| F4 — Library experience | Home, folder/subfolder screens, editor sheet, search sections, destination picker, selection and safe Remove folder. | Component/navigation tests and on-device main journeys in light/dark/large text. |
| F5 — Import and reminder picker | Persist destination through import/recovery; shared browse/pick mode; detail location. | Import/remove-destination/crash fixtures; attachment draft preserved; existing alarm plays same media after move. |
| F6 — Full backup and restore | Real media pipeline plus archive 2.0 hierarchy, versioned old-reader handling, Merge/Replace/rollback. Can start after F1 contract while UI proceeds. | Round-trip on fresh install with bytes, folders and reminders; hostile/cyclic graph rejection; restore interruption recovery. |
| F7 — Release hardening | Performance, language/a11y matrix, destructive-action review, regression suite, release notes. | All required LBF cases pass; no loss, stale search, unseen items or false backup claims. APK only from clean, current primary checkout under existing project rules. |

Indicative effort for one engineer: F0–F5 about 12–18 focused working days; F6 about 7–12 days given the observed full-media-backup gap; F7 about 3–5 days. Budget **roughly 4–7 engineering weeks** including integration, subject to re-estimation after F0 fixtures. This is a scope estimate, not a delivery promise. A development preview can show folders earlier, but public completion still requires safe persistence and backup evidence.

No new dependency is assumed for the first pass. Optional FTS, gesture drag/drop, multi-album membership, auto-classification, arbitrary nesting, custom cover editing, whole-folder sharing and “select all matching” are separately scoped later enhancements.

## 16. Requirement and acceptance catalog

These are proposed new IDs, not passing test results. Extend MR-21 during implementation; keep existing IDs intact.

| ID | Acceptance | Related existing requirement | Planned evidence |
|---|---|---|---|
| LBF-001 | Main folders and one subfolder level; third level/cycles rejected at native/DB boundary | PRD-012, DAT-002 | DB-FOLDER-DEPTH |
| LBF-002 | Create/rename validates Unicode names and sibling uniqueness; repeated names elsewhere allowed | PRD-012, ACC-007 | UT-FOLDER-NAMES |
| LBF-003 | Every media asset has zero or one folder; Unsorted is derived, not duplicated | DAT-001/002 | DB-MEMBERSHIP |
| LBF-004 | Move one or up to 200 items atomically; stable IDs/files/reminder references | PRD-011, FUN-003 | IT-MOVE-ATOMIC |
| LBF-005 | Lost-response retries do not repeat effects; bounded conditional Undo never overwrites newer work | DAT-006/011 | IT-MOVE-RETRY-UNDO |
| LBF-006 | Folder removal preserves all media and reminders according to explicit parent/root rules | PRD-013 | IT-FOLDER-REMOVE |
| LBF-007 | Reparent/promote preserves membership and rejects depth/name/stale-state conflicts | DAT-002 | IT-FOLDER-REPARENT |
| LBF-008 | Root search finds folders and media; scoped search never silently widens | PRD-012 | E2E-LIB-SEARCH |
| LBF-009 | Search has literal wildcard handling, language fixtures and stale-response protection | SEC-006, ACC-007 | UT-SEARCH-SCOPE |
| LBF-010 | More than 100 results remain reachable; pagination survives mutations without duplicates/skips in one accepted revision | DAT-012 | IT-LIB-PAGING |
| LBF-011 | Counts, covers and detail locations update after all mutation paths | DAT-001/009 | IT-LIB-INVALIDATION |
| LBF-012 | Import destination is durable; vanished folder yields preserved Unsorted media with warning | PRD-014, DAT-006 | IT-IMPORT-DESTINATION |
| LBF-013 | Reminder picker supports folders and full search without losing editor draft | PRD-012 | E2E-PICK-FOLDER |
| LBF-014 | Schema upgrade preserves every existing media/file/reminder invariant without destructive fallback | DAT-007/008 | DB-MIG-FOLDER |
| LBF-015 | Full backup round-trip preserves bytes, hierarchy, membership and reminder links | PRD-050/051 | E2E-BKP-FOLDERS |
| LBF-016 | Bad graph/refs/counts/version/ZIP rejected before mutation; Replace recovers after faults | PRD-052/054 | SEC-BKP-FOLDER, IT-BKP-FOLDER-ROLLBACK |
| LBF-017 | Old reader rejects 2.0; legacy incomplete media is disclosed and never fabricated | PRD-053/055 | IT-BKP-VERSION |
| LBF-018 | Move/removal does not alter scheduler generations, active alarm state or playback identity | DAT-004/005 | IT-ALARM-ORGANISE |
| LBF-019 | Bulk media deletion displays all dependent reminders and requires explicit policy | PRD-013 | E2E-DELETE-IMPACT |
| LBF-020 | TalkBack/large text/RTL can create, navigate, move, search and remove without gesture-only controls | ACC-001/002/005/007/008 | A11Y-LIB-FOLDERS |
| LBF-021 | Organisation adds no network, permissions, content logging, whole-media scan or idle folder worker | PRD-002/003, DAT-012, SEC-007 | SEC-LIB-SCOPE, PERF-LIB-IDLE |
| LBF-022 | Documented performance budgets pass on the declared data/device matrix | MR-15 | PERF-LIB-LARGE |
| LBF-023 | Pin limits, duplicate paths and deleted/moved pin destinations behave consistently | PRD-012 | E2E-LIB-PINS |
| LBF-024 | Folder/All media/quick-view counts do not imply duplicated files or storage savings | MR-03/04 | UX-LIB-COMPREHENSION |

### Adversarial scenarios to run

- Move a playing asset and an asset due in a native alarm; playback/Play action still resolves the same bytes.
- Kill the process before commit and after commit/before response; retry with the same request ID.
- Rename/reparent/delete the target while the destination picker is open.
- Undo after one selected item was edited, moved again or deleted; no newer state is overwritten.
- Delete a main folder containing both media and subfolders; flatten exactly once to Unsorted.
- Revoke media source URI access after original import; folder browsing/move remains independent of that source.
- Search a Tamil or Arabic folder name, literal `100%`, underscore, apostrophe, emoji and combining characters.
- Scroll through 10,000 items; then import, rename, delete or move between pages; reject mixed revisions.
- Restore archives with missing parents, cycles, third-level children, duplicate sibling names, conflicting IDs, foreign media references and too many folders.
- Import into a folder, remove it during streaming, then restart; the valid asset is in Unsorted with a recoverable result.
- Test Move/Delete at 200% text, in RTL and with TalkBack, keyboard and switch navigation.

## 17. Review and handoff

This plan is complete as a proposal for review. The user selected two levels; remaining defaults above are recommendations, not claims of approval or implementation. The feature is not yet coded. Existing Android theme and iPhone feasibility work are preserved.

Planning verification: inspected live Library, selection, picker, importer, native query/entity/database, backup/version code and requirement catalog; checked proposed scope for naming/depth/move/delete/backup contradictions. Document validation found 24 unique requirement IDs, eight work packages, no unresolved TODO/TBD markers, and valid concept-board SVG/internal references. No app builds, migrations, performance tests or device tests were run for this planning request. The concept board is a static layout illustration with synthetic counts, not a running UI; rendered/device visual review has not been performed.

Before coding, approve or revise the visible design and core decisions: one home per item; two levels; safe folder removal; explicit scoped search; preserved reminder links; complete pagination; and archive 2.0 release dependency. Implementation should report exact tests/results and remaining device evidence against LBF-001–024, rather than marking the whole feature complete when a folder card renders.
