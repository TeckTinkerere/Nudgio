# Android v2 library and backup contract

Implements the approved folder plan in `plans/2026-09-28-android-library-folders-plan.md`.

## ADR-023: local library hierarchy and archive 2.0

Accepted for implementation, 2026-09-30. Room remains authoritative. Schema 6 adds folders, single-home media memberships and a library revision/undo record. Existing media bytes, media IDs, reminder IDs and legacy category values are preserved. Unassigned media is Unsorted. A main folder may contain subfolders; a subfolder cannot contain another folder. Folder deletion never deletes media or reminders.

Folder names are trimmed, NFC-normalized, whitespace-collapsed and limited to 60 Unicode code points. Sibling names must be unique after locale-independent case normalization. Maximum 500 folders, 8 pins, 200 media per atomic move. Mutations require the revision displayed to the user; stale changes fail visibly. The most recent move may be undone for ten minutes if the library has not changed.

Browsing uses native bounded media queries. Main-folder scope includes direct media and immediate subfolders. Unsorted has no membership. Search matches folder names and media title/notes; changing location clears selection. Moves change membership, never copy or recompress a file.

Archive writer 2.0 requires reader 2.0. It includes original media bytes, folder records and memberships. Import validates checksums, graph depth, uniqueness, references, declared sizes and storage reserve before replacing logical data. New files receive fresh opaque storage keys; existing files are retained until the Room transaction commits. Recovery removes only unreferenced files created by the interrupted operation. Archive 1.x is inspect-only because earlier writers omitted media and cannot reconstruct it. Unknown newer formats never mutate data.

No network, new Android permission, dependency, service or recurring background work. Thumbnails are disposable; original images remain unchanged. Release acceptance requires migration, backup round-trip/corruption tests, folder interaction tests, and device alarm/upgrade checks. Automated source tests alone do not satisfy device acceptance.

Traceability: LBF-001 through LBF-024 in the folder plan; PRD-001/002/003/050/052; DAT-007; BKP-001/012; REL-001/002/005; ACC-001/002. Evidence and any outstanding parts must be recorded before release.
