# fixtures/

Synthetic media and backup fixtures used by tests and manual QA.

MR-18: "Never commit personal media, real backup files, signing keys,
keystores, private diagnostics or secrets. Fixtures are synthetic and
licensed." Nothing under this directory may be a real user's content.

Empty for now — the import/export pipeline that would consume fixtures here
(`android/app/src/main/java/com/aslam/mediareminder/backup/`,
`android/app/src/main/java/com/aslam/mediareminder/media/`) is not yet
implemented (see the READMEs in those folders).
