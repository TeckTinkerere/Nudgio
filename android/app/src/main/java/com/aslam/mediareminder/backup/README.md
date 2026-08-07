# backup/

Owns `BackupRepository` and the two-phase export/import pipeline (MR-10,
ADR-013, ADR-014): logical JSON+media ZIP export, private-staging import
validation, conflict planning and commit.

Intentionally empty in this change; see `alarm/README.md` for why.
