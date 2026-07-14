# Changelog

All notable changes to Exadious Tanoth Companion are documented in this file.

## [1.1.0] - 2026-07-14

### Added

- Persistent daily bot statistics with Discord delivery at 12:00 local time.
- Configurable Discord event notifications for system status, adventures, PvP, dungeons, work, resources, equipment, inventory, player events, and guild activity.
- Guild dashboard with overview, members, bonuses, upgrade levels, and recent activity.
- Safe guild automation for gold donations and gold-only upgrades, including reserves, priorities, and daily limits.
- Automatic work after three unsuccessful PvP checks when no adventure or dungeon action is available.
- Automatic PvP and dungeon routines with configurable limits and bloodstone protection.
- Automatic inventory selling and equipment upgrades for the player and individual companions.
- Reports for the latest PvP battle, adventure, dungeon battle, and work session.
- Player, companion, equipment, inventory, mount, potion, and guild details in the dashboard.
- Complete German, English, French, and Spanish UI localization, including dynamic labels and accessibility text.

### Changed

- Renamed the application to **Exadious Tanoth Companion**.
- Redesigned the dashboard with the red Exadious theme and responsive equipment layouts.
- Merged daily and event Discord settings into one structured settings area.
- Made every bot settings category independently collapsible and collapsed by default.
- Moved gold and bloodstones below the experience bar and arranged them vertically.
- Displayed task countdown and estimated completion time on separate lines.
- Improved item and companion name resolution from live game-session data.
- Reworked daily statistics persistence so values survive bot and server restarts during the same day.

### Fixed

- Restored reliable player attributes, resource values, item names, and player portrait retrieval.
- Prevented duplicate work sessions after a server restart by detecting and waiting for the active game task.
- Prevented PvP, dungeon, equipment, selling, guild, and adventure routines from starting while existing work is active.
- Fixed invalid or missing task durations and incomplete circle data handling.
- Fixed resource values being written into removed dashboard elements.
- Fixed collapsible eye icons and their expanded/collapsed accessibility states.
- Filtered noisy browser, WebGL, and diagnostic messages from the visible protocol.

### Security and privacy

- Kept browser profiles, runtime caches, reports, statistics, logs, local configuration, and environment files out of Git.
- Kept Discord webhook URLs exclusively in the ignored local `config.json`.
- Removed dependencies on hard-coded player, guild, companion, item, and session data.
- Added archive files to `.gitignore` to prevent accidental publication of local build artifacts.

## [1.0.0] - 2026-07-13

- Initial public release with persistent browser login, headless bot execution, and local web dashboard.
