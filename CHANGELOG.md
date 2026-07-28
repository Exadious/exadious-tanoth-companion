# Changelog

All notable changes to Exadious Tanoth Companion are documented in this file.

## [1.3.0] - 2026-07-28

### Added

- Added manual inventory-item equipping from the dashboard, including equipped-item comparisons in inventory tooltips.
- Added an equipment safety option that prevents swaps from creating or worsening negative total attributes and prioritizes repairs for existing negative totals.
- Added automatic runtime recovery for expired game sessions through the stored Gameforge lobby session.

### Changed

- Reordered bot actions to prioritize likely winnable dungeon/card battles, followed by adventures, PvP, and work.
- Made the adventure routine wait until the next day after the daily adventure limit is reached.
- Improved PvP deferral so stale task information no longer blocks fights indefinitely.
- Improved resource retrieval with a player-data fallback when the lightweight update response omits gold or bloodstones.

### Fixed

- Fixed repeated `NaN` attribute-cost and resource errors after a game session expired.
- Fixed attribute routines continuing after invalid or unavailable cost data.
- Fixed dungeon availability checks that could miss valid opponents when the server omitted optional comparison fields.
- Suppressed harmless browser audio, WebGL, and unresolved optional-resource warnings from the dashboard log.

## [1.2.0] - 2026-07-17

### Added

- Added persistent weekly, monthly, and lifetime statistics with gold and experience rates per hour.
- Added a configurable weekly Discord summary and rare-item notifications containing item details and value.
- Added an optional adventure difficulty fallback and a separately configurable forced PvP fight.

### Changed

- Made adventure difficulty selection exact unless the new fallback option is enabled.
- Reworked automatic PvP into four groups of three checks, with a five-hour pause between groups and an optional forced fight after the twelfth unsuccessful check.
- Completed and aligned all German, English, French, and Spanish language packs.

### Fixed

- Fixed work reports showing `+0` gold when the shared resource snapshot had not been updated.
- Fixed adventure reports and Discord notifications showing zero rewards despite a completed adventure.
- Improved PvP opponent discovery for nested opponent lists and added a high-score fallback.
- Preserved pending adventure data across restarts so the completed adventure can still be reported correctly.

### Security and privacy

- Excluded the local long-term statistics file from Git.
- Kept runtime profiles, local configuration, reports, logs, and Discord credentials outside the repository.

## [1.1.1] - 2026-07-16

### Added

- Added a persistent work report with status, start time, end time, duration, gold reward, and completion timestamp.
- Added a midnight work scheduler that calculates the automatic start time from the configured duration so work finishes at 00:00.
- Added a final availability check immediately before scheduled work begins.

### Changed

- Continued work reports across server restarts and reconstructed missing start times from the configured duration when required.
- Displayed planned automatic work with a dedicated `Scheduled` status.
- Completed dynamic accessibility translations for inventory slots and localized the latest-action text for sold inventory items.

### Fixed

- Prevented a resumed work report from replacing its original start time with the server restart time.
- Prevented missing work duration values from being rendered as `0 h`.
- Kept existing work sessions untouched when enabling the new midnight scheduling behavior.

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
