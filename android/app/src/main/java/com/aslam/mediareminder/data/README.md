# data/

Owns Room (`ReminderRepository`, entities, DAOs, migrations — MR-09) once
reminder persistence is implemented.

`PreferencesRepository.kt`, `ReminderProfileSeed.kt` and
`DynamicColorProvider.kt` already live here: preferences/appearance and the
built-in profile seed are configuration data and Material You extraction is
platform capability reading, not reminder scheduling logic, so they are in
scope for this architecture foundation.
