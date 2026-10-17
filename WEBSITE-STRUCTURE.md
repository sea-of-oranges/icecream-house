# Website Structure

## Project files

```text
Website(Icecream house)/
├── index.html             # App markup, sections, and controls
├── style.css              # Themes, layout, responsive styles, and components
├── script.js              # Navigation, state, rendering, and interactions
├── audio/                 # Local OGG songs used by the Home music player
├── mood-faces/            # Illustrated mood choices and calendar markers
├── supabase-config.js     # Optional Supabase connection settings
├── CHANGELOG.md           # User-facing website update history
└── WEBSITE-STRUCTURE.md   # This architecture and page guide
```

## Application shell

`index.html` defines the document and loads the stylesheet and scripts. The page contains:

- **Authentication screen** — sign-in, account creation, and password recovery.
- **Persistent top bar** — Icecream House home link at the left; live clock, Mood today, Updates, and log out at the right.
- **Mood check-in** — Saves the chosen illustrated face for the current date and shows it in the monthly calendar.
- **Workspace layout** — sidebar navigation beside the main content.
- **Updates popover** — versioned release notes, opened from the top bar and dismissed by its close control, outside click, or Escape.
- **Footer** — shown on the main workspace, hidden while a standalone tool is open.

## Workspace views

The sidebar switches between four workspace views. The JavaScript moves the existing HTML sections into these view containers when the app starts.

### Home

- Welcome message
- Flip clock and clock controls
- Halton weather
- Upcoming HDSB secondary-school calendar
- Theme colors and light/dark mode
- Songs player with the local playlist and playback controls
- White noise player
- Background Studio and personalization controls

Theme colors appear above Songs and White noise; Background Studio and Personalize follow those sections. On wide landscape screens, the clock and weather stay together on the left while the welcome text sits above the HDSB calendar on the right. Portrait and narrow layouts retain a stacked arrangement.

### Calendar & Events

- Monthly calendar with per-day task and event labels
- Event creation form, including repeat options
- Daily tasks for the selected date
- Weekly due tasks
- Upcoming task list

`script.js` combines user events, daily and upcoming tasks, and HDSB dates when drawing the monthly calendar. Exam/test tasks are prioritized, and busy month cells have scrollable task lists.

### Tools

- Pomodoro countdown timer
- Quick Note

Each tool opens as a standalone screen within the app shell, rather than as a section below the workspace. Both screens provide a Back home control. Browser history also tracks workspace and tool navigation.

### Study

- First-time setup starts with four searchable course fields; more rows can be added and custom course names can be entered.
- Each selected course has its own page and separate saved course notes. Course study tools are currently omitted and can be added later.
- The Grades subpage records exams/tests, quizzes, and assignments for any selected course. Assessment categories have configurable percentage weights, defaulting to equal weights.
- Estimated grades average marks within each assessment category and use the configured weights for categories with marks.
- Grade progress can be filtered by one, multiple, or all courses. Assessments can be edited or deleted from the history table.
- Restarting course selection requires confirmation and preserves existing grades and notes.

## JavaScript responsibilities

`script.js` is a plain browser script. Its main responsibilities include:

- Reading and writing account-scoped browser storage.
- Restoring sessions and coordinating optional Supabase sync.
- Setting up sidebar, browser-history, and tool navigation.
- Rendering calendars, task lists, the HDSB schedule, and updates.
- Saving daily mood choices and rendering their illustrations in the mood picker and calendar.
- Managing course setup, course-specific notes, assessment records, grade estimates, and the SVG course comparison chart.
- Handling event repeats, task completion, deletion, and forms.
- Updating the clock and loading weather data.
- Building the Songs playlist from `audio/` and handling playback.
- Saving the selected song and mood to the signed-in account when Supabase sync is available.
- Saving appearance, timer, and note preferences.

The app uses local storage for its core data. Supabase support is optional and configured in `supabase-config.js`.

## Styling and external services

`style.css` contains shared components, color themes, page layouts, and responsive breakpoints. It includes wide-landscape rules for the Home dashboard and mobile rules for the top bar, compact sidebar, and Study gradebook.

The page also loads Google Fonts, the Supabase JavaScript client, and weather information from Open-Meteo. The HDSB source PDF is linked from the school-calendar widget.
