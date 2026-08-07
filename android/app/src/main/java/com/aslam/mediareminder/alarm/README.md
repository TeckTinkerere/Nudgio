# alarm/

Owns `SchedulerCoordinator`, `AlarmSessionCoordinator`, `AlarmDispatchReceiver`,
`AlarmActionReceiver`, `SystemEventReceiver`, `AlarmRingingService` and
`AlarmActivity` (MR-06, MR-07 component map).

Intentionally empty in this change: "Do not implement reminder logic yet."
The manifest declares no alarm-related permission or component until this
package's first real class lands alongside the ADR/spec updates MR-18
requires for a new permission or background component.
