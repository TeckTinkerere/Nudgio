# Android Library redesign — familiar file explorer

**Status:** Revised interaction plan, 1 October 2026; implementation is in progress and must be validated separately.  
**Scope:** Android Library browsing, organisation, and the reminder media picker. Local-only; one main-folder and one subfolder level; one folder home per asset. Backup repair and cross-device sync remain separate work.

## What is wrong today

The current `LibraryScreen` places folder search, a chip for every matching folder, an inline new-folder form, media search, and a row of media filters before the first asset. Subfolders are distinguished only by a `↳` prefix. A folder opens by narrowing the first 100 globally queried media items in JavaScript. This can display a false empty folder and makes older items unreachable. Selection offers Export/Delete but no Move. The root and folder views share one undifferentiated layout; the folder title is a plain line after a “Library” back button. Error handling for folder commands is largely invisible. These are source observations, not a claim about a particular installed APK.

Keep the working parts: native Room data, media cards and previews, existing responsive two-pane detail, one-home memberships, and Ink & Apricot theme. Redesign the information architecture and finish the query/actions needed to make the design honest.

## Direction and alternatives

| Direction | Benefit | Cost | Decision |
|---|---|---|---|
| Media feed with a folder strip | Familiar starting point | Folder strip becomes another crowded chip row | Reject |
| Folder-first collection with an All media switch | Puts organisation ahead of clutter while keeping one-tap access to every asset | Needs distinct root and folder surfaces | **Use** |
| Separate folder-management area | Keeps media grid simple | Hides Move and creates needless navigation | Reject |

The root initially opens **Folders**. A compact two-option control switches between **Folders** and **All media**; the last choice can be stored locally. The user can open a folder, then a subfolder, using the same controls at each level. Search is one entry point within the visible location, with an explicit option to search the whole Library. There is no permanent row of every folder or inline create form. The existing four-tab Android navigation stays.

**User correction:** Treat folders like a normal file explorer. The + button appears at root and within folders; it offers New folder (or New subfolder when permitted) and Import media. A Select button and long press enter selection. The bottom bar changes to selected count, Move and Delete. Folder paths are visible as breadcrumbs. The Move picker navigates the same hierarchy and allows selecting both folders and media. Keep all controls discoverable; gestures are shortcuts, not requirements.

## Visual specification

### Root, typical phone

```text
┌──────────────────────────────────────┐
│ Library                        Select│  floating app bar
│ Search Library                   🔍  │  one search field
│ [ Folders ] [ All media ]            │  compact view switch
│                                      │
│ Unsorted                     18 items│  quiet inbox row
│                                      │
│ PINNED                               │  omit when empty
│ [Learning › Languages     12 items] │
│                                      │
│ YOUR FOLDERS                     +   │
│ ┌────────────────┐ ┌───────────────┐│
│ │cover peeks      │ │cover peeks     ││
│ │Learning        │ │Wellbeing      ││
│ │32 items        │ │24 items       ││
│ │2 subfolders  ⋮ │ │2 subfolders ⋮ ││
│ └────────────────┘ └───────────────┘│
└──────────────────────────────────────┘
```

The app bar occupies one row. Search sits below it, with 16dp horizontal inset and a 48dp minimum hit area. The view switch is 40–48dp high. Folder cards use two columns on typical phones, one column when text scaling or narrow width makes two unreadable, and adaptive columns on wider screens. Cards have 16dp corner radius, 12dp internal spacing, at least 12dp gutters, two-line titles, a count and explicit subfolder count. The full card opens; a separate 48dp overflow target opens Rename, Pin, Move folder, and Remove folder. Avoid placing nested pressables over each other.

Folder covers are calm stacked-paper shapes with up to three **thumbnail** peeks. Use existing cached thumbnail tokens, never original-size decode in the grid. Audio/text get matching simple icon or waveform/text treatments. Empty folders get a deliberate illustration. Do not use a different randomly assigned colour per folder. Paper `#FFFEFA` on warm ivory `#F7F4EE`, deep-ink type `#202638`, ink-blue `#2D4DB5` for selection/actions, and small apricot `#E9B58E` tabs echo the sculptural blue-n/apricot-orb logo. Dark mode maps through existing semantic tokens, including moon-blue `#BAC8FF`; Material You remains opt-in. No hard-coded colours in screen components.

The **All media** view immediately shows the media grid, not a second folder header. Its search/filter bar is sticky or compact as the grid scrolls. Put kind filters and sort in one Filter sheet with an active-filter indicator and a clear action. Show integrity filters only when relevant. Avoid dedicating multiple horizontal rows to controls. Media cards retain their real aspect ratios and visible reminder/missing markers; playback begins only after explicit Play.

### Main folder and subfolder

```text
‹ Library                 Learning    ⋮
32 items · 2 subfolders
Search in Learning

SUBFOLDERS
[Languages · 12] [Talks · 14]

IN LEARNING · 6 ITEMS           Select
[media grid, all six direct items reachable]

                            + Add here
```

The main-folder view separates immediate subfolders from **direct media**. Its headline count includes descendants, while the media-section count is direct only; label both so numbers reconcile. A subfolder has no further folder section or New subfolder action. Provide a compact location row (`Library › Learning › Languages`), preserving readable names at large text sizes by truncating visually and announcing the full path to TalkBack. Android Back closes keyboard/sheet/selection first, then returns to parent with search/filter/sort/scroll anchor restored. The wider two-pane layout keeps media detail on the right and folder navigation/grid on the left.

The root create action opens a **New folder** sheet. Inside a main folder, **Add here** opens Import here / Move existing media here / New subfolder. Inside a subfolder, omit New subfolder. These are context-aware actions, not persistent text fields.

## Search and movement

One search field changes scope with location. At root it displays separate **Folders** and **Media** result sections with counts and location paths. Inside a folder it searches that folder's direct media and, for a main folder, its immediate subfolders and their media. A scope chip reads “In Learning”; **Search all Library** is an explicit escape hatch. Clearing search returns to the prior scroll position. A global result opens the item or folder and visibly states its path. Empty results say where the search ran. Unicode names and literal `%` / `_` must be handled safely; stale query responses must not replace newer results.

Select mode is available from the app bar and each item menu; long press may be a shortcut but never the only path. A bottom action bar shows `3 selected` and **Move**, Export, Delete; smaller widths may put Export/Delete in an overflow menu while Move stays visible. Move opens a destination sheet with Library/Unsorted, main folders, and indented subfolders, plus a search field. The sheet shows the full path, disables invalid destinations with explanation, and confirms the result by naming the destination. The folder closes the selection state only after native success; on failure it keeps selections and explains what happened. A brief Undo uses the existing conditional native undo contract. Moving changes membership only—no file copy, recompression, reminder ID or alarm change.

Media detail should get a Location row and Move action. Folder menus handle rename, pin/unpin, move folder and remove folder. Remove folder confirmation says exactly where contained items will go and states that reminders and files remain. Bulk media Delete requires confirmation and uses the safer non-cascade native policy: linked reminders are disabled, not deleted. A future cascade option would need an exact affected-reminder summary and explicit choice. Do not equate removing a folder with deleting media.

## States and content

| State | Visible treatment / action |
|---|---|
| No media or folders | Logo-inspired small illustration, “A place for what matters,” primary Import, secondary New folder |
| Media but no folders | “Give your Library a little order,” New folder; Unsorted count remains obvious |
| Empty folder | “Nothing here yet,” Import here and Move existing media here |
| No scoped result | “No matches in Learning,” Clear search and Search all Library |
| Initial load | Stable skeleton card/grid geometry; no jumping controls |
| First-page failure | Error with Retry, never a false empty state |
| Later-page failure | Keep loaded items, show Retry footer |
| Import in progress | Show progress without replacing or hiding previously loaded collection |
| Stale/deleted folder | Return to surviving parent, announce change, leave media discoverable |

Copy uses plain nouns and exact counts with plural-aware translations. “Unsorted” is a virtual place, not another copy. Do not imply folders save storage or that backup currently protects folder/media contents.

## Work sequence and contracts

1. **Freeze the interaction contract.** Confirm root preference, direct-versus-descendant count labels, search scope, delete consequences and selection behavior. Create low-fidelity phone/dark/large-text/tablet mockups and review them before UI coding. Reuse the existing folder plan and ADR-023; amend a spec/ADR only if the final behavior changes a persisted or archive contract.
2. **Make data complete before polishing it.** Add folder scope to native `MediaQuerySql`/service and the JS `MediaQuery` contract; support root, direct-folder, recursive main-folder, Unsorted and reminder-use views where implemented. Page through results (e.g. 50 at a time) with stable ordering and revision-aware invalidation. Never filter the first 100 global results in JS. Return bounded folder summaries/counts/covers rather than every membership ID in a full snapshot. Keep `DAT-012` startup free of whole-library enumeration. Use the same path for reminder media picker.
3. **Build reusable surfaces.** Extract root collection view, folder view, folder card, search results, filter sheet, contextual actions, destination sheet, and named state components from the monolithic `LibraryScreen`. Keep the existing `MediaCard`, preview and two-pane detail. Navigation state is by stable folder ID; folders are not filesystem paths.
4. **Complete actions.** Wire create/rename/pin/reparent/remove, import destination, single/bulk Move, conditional Undo, and safe Delete confirmation to native outcomes. Show native validation and stale-revision errors near the action. Preserve local files, media IDs, reminders and scheduler state during organisation.
5. **Polish and verify.** Check contrast and spacing in light/dark/Material You, 1.3×/2× font, narrow phone, tablet and RTL. Validate TalkBack traversal and target sizes. Test large libraries and mutations while searching/paging. Record device evidence before claiming the design release-ready.

No new backend, account, permission, analytics, internet access, background worker, or whole-library photo recompression is part of this redesign. Existing originals stay untouched; cache thumbnails may be regenerated or compressed only at a visually lossless quality validated on image/text-detail fixtures. Backup repair remains on hold as requested, so this plan does **not** claim a full safe archive or restore for organised media. Release copy and in-app backup claims must reflect that limit.

## Acceptance checks

- A user with 500 media items and 30 folders can reach the last item from All media, its folder and search; no false empty folder at item 101 or later. Pagination retains loaded items after a next-page failure.
- Root opens with folders visibly grouped, with first useful content above the fold on a typical phone. Folder cards communicate name, total items and subfolders without `↳` chips. All media remains one tap away.
- Root search finds a nested folder and a media title; scoped search never silently widens; a result shows its location. Back restores the previous view.
- Five selected items can be moved to a subfolder, then safely undone before another mutation; original bytes, media IDs and linked alarms/reminders are unchanged. No third-level folder can be created or selected.
- Delete of media with linked reminders cannot silently delete those reminders; the current bulk path disables them after confirmation. A future cascade choice requires exact dependent counts. Folder removal preserves files and reminders.
- Import directly into an open folder lands there, or safely in Unsorted with a visible message if that folder disappeared during import.
- Empty, loading, error and import states are distinguishable. All actions have readable labels, 48dp targets, keyboard/TalkBack alternatives, translated plural copy and RTL-safe layout.
- Use native query/move/migration tests, React Native component/navigation tests and on-device Android checks. Record exact results; a source-only review is not acceptance.

Traceability: `PRD-012`, `UX-001`, `DAT-012`, `ACC-001/002/005/007/008`, and existing folder-plan `LBF-001–014`, `LBF-018–024`. `LBF-015–017` (full archive/restore) remain deferred and must be reported as such. No migration is expected for a purely visual refactor, but query-contract or persisted-state changes must receive the required tests/spec update.
