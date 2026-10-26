# Changelog

## Version 1.3 — October 25, 2026

Study Workspace & Gradebook Overhaul
- Grouped assessment types in the general weight settings into four main categories: FPT, Final Exam, Participation, and Other (Quiz, Test, Assignment).
- Added the ability to assign custom percentage weights to individual assessments.
- Added a "Confirm Weights" button to the gradebook settings to safely auto-balance remaining category weights to 100%.
- The assessment history table now calculates and displays the real-time effective weight of every item (using `~` to indicate auto-distributed weights).
- Added smart weight rollover: if a category (e.g., Final Exam) has no marks yet, its weight is automatically and proportionally distributed to active categories, complete with a dynamic explanatory message.

Personal Workspace Enhancements
- Added a "Close" button to the table customizer and the ability to rename tables.
- Improved the "Image Link" column to hide long URLs behind a clean "Edit Link" toggle button.
- Fixed layout bugs causing the custom multi-select dropdowns to be clipped and textareas to collapse on page refresh.

System Fixes
- Fixed the monthly calendar so daily/upcoming tasks no longer clutter the calendar view, while official events correctly sync to daily tasks.
- Fixed a cloud sync bug where clearing the custom background or resetting the clock failed to update across devices.

## Version 1.2 — October 21, 2026

- Added a new "Personal" workspace to organize custom lists and trackers.
- Introduced a command-based typing bar (e.g., `/create_new_table`) to generate content quickly.
- Added dynamic, structured tables with templates for Watching Lists, Financial tracking, Data Management, and Book Lists.
- Updated Image Links to instantly render image thumbnails inside the table rows, with a clean "Edit Link" toggle.
- Upgraded the "Genre" field to use a custom-built Multi-Select dropdown for Watch/Book lists.
- Fixed the calendar sync logic: tasks added in Daily/Weekly/Upcoming no longer clutter the Monthly calendar dots, but Monthly events still sync down into Daily tasks.
- Added a real-time table customizer to rename columns, change data types (Text, Number, Date, Select, Multi-Select), manage dropdown options, and delete tables.
- Enabled automatic cloud and local syncing for all personal tables.

## Version 1.1 — October 17, 2026

- Added the daily mood picker using the supplied illustrated faces; selected moods also appear in the monthly calendar.
- Added the Songs player for supplied audio files and a full-width white noise player to Home.
- Placed theme colors above Songs and White noise, followed by Background Studio and Personalize.
- On wide landscape screens, the clock and weather stay left while the welcome text and HDSB calendar sit on the right.
- Removed the two welcome-screen buttons and enlarged the greeting and description without changing the headline size.
- Updated the Home background glow to match the selected theme color.
- Added the Study workspace, course pages, notes, assessment gradebook, weighted estimates, and grade progress chart.
- Updated the HDSB calendar, added daily refresh, and made monthly calendar task lists scrollable.
- Prioritized Exams/tests tasks in daily tasks and the monthly calendar.
- Opened Quick Note and the Pomodoro timer as separate screens with a Back home option.
- Added an Updates panel for website changes and fixes.
