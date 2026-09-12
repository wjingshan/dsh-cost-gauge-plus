# dsh-cost-gauge-plus

[中文](README.md) | English

A **cost gauge** for DeepSeek Harness (`dsh`): a **resizable, expandable/collapsible** floating window near the **upper left** of the Web UI showing DeepSeek API spend and balance in real time. A **minimal clock** (single hand + two-tone outer ring) shows whether the current rate is off-peak or peak, and a **red lamp** blinks at the top when the balance drops below the configured threshold. Supports **multiple skins** (classic clock / minimal digits / ring gauge / mini status bar).

> 💡 **Relationship to dsh-cost-gauge**: `dsh-cost-gauge-plus` is an **independently maintained version** forked from `dsh-cost-gauge` v1.4. Package name, plugin id, API paths and CSS prefixes are fully isolated, so it can be installed **side by side** with `dsh-cost-gauge` without interference.

## Screenshots

| Classic clock (default) | Test 1 (starry skin, dark mode) |
| --- | --- |
| ![dsh-cost-gauge-plus classic clock skin](docs/classic.png) | ![dsh-cost-gauge-plus starry skin](docs/test1.png) |

> In dark mode the starry skin renders the off-peak arc as a deep star-field gradient (#040a3a → #00081e); the specks inside brighten, fade and reappear at new positions.

## What's new in v1.5.0

- **Auto step-aside when the window is resized**: after you stretch or resize the window, if the widget covers the middle conversation **text column** it moves into the **blank gap between the text column and the sidebar** — centred in that gap and placed in its **lower part** (flush with the bottom of the window; if that would cover the composer it stops 8px above it). Only when the gap is too narrow does it fall back to the sidebar column.
  - Priority: **middle text column (never covered) > bottom composer > sidebars**; ties keep "left stays left, right stays right" with the smallest movement.
  - Triggered only by **window resizes** (150 ms debounce); it never fights a manual drag and is skipped in the narrow strip mode.
  - The gap fits when one side's clearance is ≥ widget width + 16px: at the default 264px that needs a window ≳1792px (middle column ≥ 1512px, sidebar expanded, right bar closed); at the minimum 200px it is about 1569px.
- **Auto-dock when the sidebar collapses**: when DSH collapses the sidebar (or the viewport is very narrow) the narrow strip docks to the **right of the sidebar**; with the sidebar expanded it docks under the "Sessions / Workspaces" heading, and it restores the previous skin/expanded state when narrow mode ends (the dock position is never persisted).
- Narrow strip width 48px → **36px**.
- Internal fix: the "chat content column" used by the step-aside logic is derived from `--dsh-chat-content-width` (the centred content band inside the panel) with proper `clamp()/calc()` resolution, falling back to the composer card width and then to the whole middle panel.

## What's new in v1.4.0

| Narrow window → vertical mini |
| --- |
| <img src="docs/screenshot-narrow.png" width="120" alt="Vertical mini: status lamp + cost + balance + model badge"> |

- **Viewport-aware vertical mini**: a `ResizeObserver` watches the viewport width; at **779px or less** the gauge switches to a 48px-wide **vertical mini** (top to bottom: status lamp → session cost → balance → model badge, rendered vertically) and **expands on click**. At **860px or more** it leaves the mini and restores the **skin and expanded/collapsed state** you had before.
  - **Hysteresis** (enter 780 / exit 860) prevents flicker at the threshold; after you manually expand from the mini strip it stays expanded until the window grows to 860px or more again.
  - The window is kept **inside the viewport** on every change (so a 48px strip can never end up off-screen).
  - Thresholds can be overridden via `localStorage` keys `dsh-cost-gauge-plus:narrowEnter` / `dsh-cost-gauge-plus:narrowExit`.

## What's new in v1.5.0 (synced with dsh-cost-gauge)

| Spend records panel (English) | 花费记录面板（中文） |
| --- | --- |
| <img src="docs/screenshot-records-en.png" width="380" alt="Records panel: ranges, chart, detail"> | <img src="docs/screenshot-records.png" width="380" alt="花费记录面板"> |

- **Correct cost math**: the host replays the session event log and prices every usage event at “rate at that moment × model at that moment” — off-peak usage at the off-peak rate plus peak usage at the peak rate. This fixes the old behaviour where entering the peak window re-priced the whole history (cost doubling). `llm/retry-started` and repeated samples for the same turn/step **replace** rather than accumulate, and records cover the session's full history.
- **New “Records / Reset” icon buttons** (in the title bar; borderless mini icons with hover hints):
  - The records panel offers `All time / Year / Month / Week` filtering and paging, a **stacked bar chart** (by band or by model) and a detail table that lists **only periods with usage**. Scope switches between `This session` and `All sessions`. The panel is draggable, may cover the floating window, and is pulled back inside the viewport when out of bounds.
  - Reset is a two-step confirmation that moves the baseline and restarts from ¥0.00 (history is kept).
- **Excel export is now a real `.xlsx`** (OOXML; hand-written minimal zip writer, zero dependencies; opens in Excel/WPS with no format warning): two worksheets plus a note row; default file name `<session name>_<start>-<end>.xlsx`. A default save folder can be configured in Settings (exports then write directly with no dialog); `📂 Open` reveals the file in Explorer afterwards.
- **Host-side accounting**: the session event log is replayed every 15 s and persisted to `~/.dsh/cost-gauge-plus/ledger.json` (fully separate from `dsh-cost-gauge`'s data file).
- **Bilingual UI**: follows the DSH client language setting, falling back to the system/browser language (`zh*` → Chinese, otherwise English).

## Features

- 🕐 **12-hour clock face** — the outer ring is two-tone: **green = off-peak (standard)**, **yellow = peak (busy)** (all green at weekends); the white hand shows the current time.
- 🛢️ **Inner odometer (balance fuel gauge)** — arc scale where full = highest balance seen, a **red segment = low-balance zone**, and the orange→green arc marks the current balance.
- 🖐️ **Drag & resize** — drag the title bar to move, drag the bottom-right handle to scale; position and size are remembered.
- 📱 **Viewport-aware** — at ≤ 779px the gauge switches to a **36px vertical mini** (lamp + cost + balance + model badge) and restores the previous skin/state at ≥ 860px; when DSH auto-collapses the sidebar the strip docks to its right, and with the sidebar expanded it docks under the “Sessions / Workspaces” heading.
- 🪟 **Auto step-aside** — on window resizes, a widget covering the conversation text moves into the blank gap between the text column and the sidebar (centred, lower part); priority is text column > composer > sidebars.
- 🔍 **Expanded / collapsed states** — expanded shows the clock plus **session cost, balance, cache-hit rate, current model** and a countdown to the next rate switch; collapsed shows **cost, balance, remaining percentage** and two status lamps (🟡 busy / 🟢 idle), each ringed by a “remaining time” pie.
- 💰 **Session cost** — token usage priced at the official peak/off-peak rates, charged per event at the rate in force when it occurred (cache miss / cache hit / output priced separately).
  - Peak: Mon–Fri 09:00–12:00 and 14:00–18:00 Beijing time
  - Off-peak: all remaining hours, including the whole weekend; half the peak price
- 🗒 **Spend records** and ↺ **reset** — see “What's new” above.
- 🔴 **Low-balance alarm** — the top lamp blinks red below the threshold (default ¥10).
- ⚙️ **Configurable threshold** — click the gear; takes effect immediately and is remembered (localStorage).
- 🌐 **Bilingual UI** — Chinese/English selected from the DSH language setting or the system language.

## Install

### One-liner (recommended, no git needed)

```powershell
irm https://raw.githubusercontent.com/wjingshan/dsh-cost-gauge-plus/main/install.ps1 | iex
```

To install the development version or pin a tag:

```powershell
irm https://raw.githubusercontent.com/wjingshan/dsh-cost-gauge-plus/main/install.ps1 -OutFile install-dsh-cost-gauge-plus.ps1
.\install-dsh-cost-gauge-plus.ps1 -Ref main        # development (main)
.\install-dsh-cost-gauge-plus.ps1 -Ref v1.5.0      # pin a tag
```

### Manual install

```sh
dsh plugin --profile web add github:wjingshan/dsh-cost-gauge-plus#main
dsh plugin --profile web add github:wjingshan/dsh-cost-gauge-plus#v1.5.0
dsh plugin --profile web add https://github.com/wjingshan/dsh-cost-gauge-plus/archive/refs/tags/v1.5.0.tar.gz
dsh plugin --profile web add link:/path/to/dsh-cost-gauge-plus
```

After installing, **restart** `dsh web` and refresh the page.

## Configuration

The threshold can be changed from the gear in the window or overridden in the profile's `cordis.patch.yml`:

```yaml
- update:
    - id: cost-gauge-plus
      config:
        threshold: 10          # balance alert threshold (CNY)
        baseUrl: 'https://api.deepseek.com'
        apiKeyEnv: 'DEEPSEEK_API_KEY'
        refreshSeconds: 30     # balance query cache, seconds
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET  /api/cost-gauge-plus/state?session=<id>` | balance + session cost (since last reset) + rate + threshold |
| `GET  /api/cost-gauge-plus/balance` / `GET /api/cost-gauge-plus/refresh` | balance view / force refresh |
| `GET  /api/cost-gauge-plus/records?session=<id>&scope=session\|all` | daily records for one session or merged across sessions |
| `POST /api/cost-gauge-plus/reset` | reset the session cost baseline |
| `GET/POST /api/cost-gauge-plus/prefs` | read / write export preferences |
| `POST /api/cost-gauge-plus/pick-folder` | native folder picker, saved as the default |
| `POST /api/cost-gauge-plus/export` | write the `.xlsx` (two worksheets) into the configured folder |
| `POST /api/cost-gauge-plus/open-folder` | reveal the most recent export in Explorer |

## Data & security

- The balance is read through the official `GET /user/balance`; the API key is resolved on the host only and is **never sent to the browser**.
- Cost comes from replaying the session event log on the host (usage plus timestamps from `assistant/message` / `assistant/attempt`, model from `request/header`) at the peak/off-peak rate in force at each event; cache writes are not billed separately.
- Pure ESM, no third-party dependencies: the host uses Node built-ins only (accounting lives in `lib/ledger.js`), the browser half is plain JavaScript (no React).

## Directory layout

```
dsh-cost-gauge-plus/
├── package.json          # dsh.bundle (host) + dsh.client (browser) declarations
├── cordis.patch.yml      # plugin row (with default config)
├── install.ps1           # one-liner installer
├── release.ps1           # commit + bump + push + GitHub Release
├── docs/                 # skin screenshots, Alipay QR
├── lib/
│   ├── index.js          # host: balance, log-replay accounting, rate, /api/cost-gauge-plus/* routes
│   ├── ledger.js         # host: accounting, persistence, xlsx writer, folder picker / reveal
│   └── client.js         # browser: multi-skin floating window + records panel (bilingual)
└── README.md / README.en.md
```

## Release

```powershell
.\release.ps1 -Type minor -Message "feat: ..."   # or -Version 1.3.0
```

Creating the GitHub Release needs a PAT (`GH_TOKEN`, fine-grained with Contents read/write) or an interactive prompt.

## License

MIT

---

## ☕ Sponsor

`dsh-cost-gauge-plus` is maintained independently (forked from [dsh-cost-gauge](https://github.com/wjingshan/dsh-cost-gauge) v1.4). If it helps you, you are welcome to buy me a coffee ☕

<img src="docs/alipay-qr.jpg" alt="Alipay QR code" width="240" />

<div align="center">

**Thanks for your support!** 💙

</div>
