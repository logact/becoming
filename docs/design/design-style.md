# Design Style

Frozen visual language for Becoming, extracted from the prototype (`docs/design/prototype/index.html`, v0.2).
Warm, editorial, minimal: cream surfaces, deep forest-green accents, mint icon chips, outlined status pills, serif display type.

## Color

| Token | Value | Usage |
| --- | --- | --- |
| `bg` | `#F4F1E8` | Screen background (warm cream) |
| `panel` | `#FBFAF4` | Grouped containers, cards, stat tiles |
| `line` | `#E4E1D2` | Hairlines, container borders |
| `track` | `#EAE7DB` | Segmented control track, search field |
| `ink` | `#1B2821` | Primary text (near-black green) |
| `muted` | `#79837A` | Secondary text |
| `faint` | `#9AA398` | Tertiary text, captions, section headers |
| `green` | `#1F3D2D` | Primary accent: icons, progress, buttons, active tab |
| `mint` | `#DAE8DD` | Icon chip fill, active tab highlight |
| `sage` | `#3F7A54` | Done / positive states, completed progress |

State accent colors (used by status pills and attention cues):

| State | Color | Applies to |
| --- | --- | --- |
| Doing / Exploring / Active | `#3E6FB4` (blue) | Goal, Task in progress; Idea exploring; Project active |
| Todo / Captured | `#6E7670` (gray) | Goal, Task not started; Idea captured |
| Done | `#3F7A54` (sage) | Goal, Task done |
| Paused / Planning / Blocked | `#9A6B1F` (amber) | Goal, Task, Idea paused; Project planning; attention |
| Conflict | `#B4493F` (red) | Conflicting states, errors |

## Typography

- **Sans (UI text):** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif`
- **Serif (display):** `ui-serif, "New York", Georgia, serif` — screen titles, stat numbers, slogan

| Style | Spec |
| --- | --- |
| Large screen title | Serif 35px / 700, letter-spacing −0.5 |
| Inline nav title | Serif 20px / 700, centered |
| Detail headline | Serif 25px / 700, letter-spacing −0.4 |
| Eyebrow (above large title) | Sans 11.5px / 700, uppercase, letter-spacing .16em, `faint` |
| Section header | Sans 12px / 700, uppercase, letter-spacing .16em, `faint` |
| Row title | Sans 16.5px / 700, letter-spacing −0.2 |
| Row subtitle | Sans 13px / 400, `muted` |
| Meta / timestamps | Sans 12.5px / 500, `faint` |
| Tab label | Sans 10.5px / 600 |
| Slogan | Serif italic 15px, `faint`, centered — "Record what you do. Shape what you become." |

## Iconography

- Line icons, 1.7px stroke, round caps/joins, 24px viewBox (SF-symbol-like)
- Always drawn in `green` on a **mint chip**: 32×32 rounded square (10px radius); large variant 46×46 (14px radius)
- No multicolor icons — state is expressed by pills, not icon color

## Components

### Status pill

Outlined, never filled: 1.5px border in currentColor, 12px / 700 text, tiny 11px state icon, fully rounded. Color comes from the state table above.
Examples: `○ Doing` blue, `‖ Paused` amber, `✓ Done` sage, `○ Todo` gray, `⚠ Attention` amber, `! Conflicting states` red.

### Icon chip

32×32, 10px radius, `mint` background, `green` glyph. Leads list rows, goal cards, activity rows.

### Lists

Two forms:

- **Borderless list** (primary content, e.g. Doing now, Tasks, Inbox): rows directly on `bg`, 1px `line` hairlines inset 22px between rows
- **Panel list** (grouped/secondary content, e.g. Library groups, Recent activity, Settings): `panel` background, 1px `line` border, 22px radius, hairlines inset 18px

Row anatomy: `chip · title + subtitle · trailing (pill | value | meta | chevron)`. Chevron 9px, `#B7BCAF`.

### Task checkbox

32×32 rounded square (10px radius):

- Todo: 1.6px outline `#C9CDBC`
- Doing: 1.6px `green` outline + 10px filled `green` rounded-square dot
- Done: `mint` fill + `green` check; title struck through in `faint`

### Progress bar

5px high (7px on detail headers), 3px radius, track `#E3E0D1`, fill `green`; `sage` fill when complete.

### Buttons

- **Primary action** (Resume, Plan, Add): filled `green` pill, cream `#F2F0E6` text, 12.5px / 700, fully rounded
- **Nav icon button**: 38×38 circle, `green` glyph, no background
- Pressed state everywhere: opacity .5

### Segmented control

`track` background, 16px radius, 3px padding. Active segment: white pill, 13px radius, soft shadow, 700 text; inactive: `muted` text.

### Tab bar

`#F7F5EC` background, 1px `line` top border. Icon wrapped in 46×30 rounded rect (11px radius); active tab gets `mint` highlight + `green` icon/label; inactive `faint`.
Tabs: Dashboard, Library, Setting.

### Navigation

- Large-title screens: eyebrow + serif title, content scrolls beneath
- Pushed screens: chevron-only back button (deep green), centered serif title, right action (plus / pencil)
- Status bar: 9:41 left, three dots right — keep chrome minimal

### Toggle

50×30 pill, `#DCD9C9` off, `green` on, white knob.

### Tags / labels

Outlined chip: 1px `line` border, `muted` 11.5px / 600 text, fully rounded, `panel` background.

## Layout

- Screen side margins: 18px for containers, 22–24px for text headers and borderless rows
- Section header spacing: 26px above, 10px below
- Card/panel stacking gap: 12px
- Corner radii: 22px panels, 18px stat tiles, 10–14px chips and checks, 999px pills/buttons
- No drop shadows on content (flat, editorial); soft shadow only on the segmented active pill and toggles
- Every model page ends with a **Recent activity** panel (see `docs/design/design.md`)

## App shell

Per `docs/design/design.md`: status area → navigation → scrollable content → bottom navigation (Dashboard / Library / Setting). Pushed detail screens hide the tab bar.

### Capture FAB

- A 50px-high pill is inset 18px from the trailing edge. Place it 14px above the tab bar on tab screens and 24px above the bottom safe area on pushed screens.
- The surface is `green`; its leading 36×36 circular chip is `mint` with an 18px green plus. Label text is 13px / 700. Use a capture-only shadow of `0 8px 22px rgba(23,40,30,.28)` at the app-shell overlay level, above content and below sheets/toasts.
- Pressed state scales to 96% with 72% opacity. Hide (rather than disable) the FAB while any modal, bottom sheet, or Capture composer is open. During the short opening transition it is non-interactive.

### Capture composer

- Present a panel attached to the bottom edge with 28px top corners, 20px horizontal padding, safe-area bottom padding, and `0 -18px 44px rgba(27,40,33,.22)` shadow. A `rgba(18,29,22,.42)` scrim covers the underlying app chrome. The composer is above app content and the tab bar but below toasts.
- The text input is 112px high with an 18px radius. Intent chips are 34px pills. The Task Project field is a compact 38px picker in a 15px context panel and is visibly labeled `Required`.
- Submit is a 42px green pill. Disabled uses 34% opacity and no pressed feedback; it applies to blank text and to Task without a selected Project. Pressed uses 55% opacity. Loading keeps the button width stable, replaces the trailing icon with a spinner, changes the label to `Saving…`, and locks the input, intent chips, Project picker, dismiss gesture, and submit against duplicate writes.
- Validation appears next to its required context: Task without a Project accents the picker and explains `Create a project first`, with an inline escape back to Decide later. Errors preserve entered text and selections, restore interactive controls, and announce a concise message. Success closes and resets the composer before showing confirmation on the originating screen.
