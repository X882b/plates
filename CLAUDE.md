# Plates — working notes

A strength-training logger. One self-contained HTML file, vanilla JS, no build
step, no dependencies, no server. It runs offline and stores everything in the
browser on the device that opens it.

Live at `https://x882b.github.io/plates/` from the `main` branch of the
`X882b/plates` repo, root folder. Current cache version: **plates-v17**.

Written by one person for their own gym use. Prefer small, direct changes to
the existing file over refactors, frameworks or a build pipeline. The lack of
tooling is the point: it has to still work, unchanged, in three years.

---

## Files

| File | What it is |
| --- | --- |
| `index.html` | The entire app — styles, markup and logic. ~1450 lines. |
| `sw.js` | Service worker. Caches the app for offline use. |
| `manifest.json` | Name, icons, standalone display. |
| `icon-192.png`, `icon-512.png`, `icon-maskable.png` | Home-screen icons. |
| `README.md` | End-user setup and deploy notes. |

All paths inside are relative, so the folder works from any location as long as
the files stay together.

## THE DEPLOY GOTCHA — read this before shipping anything

**Every change to `index.html` must bump `VERSION` at the top of `sw.js`**
(`plates-v17` → `plates-v18`), and both files must be pushed.

The service worker serves the cached copy first. Without the bump, phones keep
the old version and the change appears not to have deployed. This has already
caused confusion once. It is the single most important convention here.

Also: upload files by drag-and-drop, never by pasting into GitHub's web editor.
A paste of this file once truncated it and shipped a broken page.

---

## Architecture

Three parts in one file:

1. `<style>` — CSS variables at the top, then layout. Mobile first; the desktop
   rules live in a `@media (min-width:900px)` block **at the very end** of the
   stylesheet.
2. Markup — the fixed shell only: header, tab bar, timer overlay, an empty
   `<main id="view">`, an empty sheet container.
3. `<script>` — everything else.

### The one pattern

All state lives in a single object `S`. Every interaction mutates `S`, calls
`save()`, then `render()`, which rebuilds the whole view from scratch. There
are no partial DOM updates and no reactive layer.

To add a feature: put the data in `S`, draw it in the matching `render*`
function, and handle the tap in the big delegated click listener at the bottom
(`document.body.addEventListener("click", ...)`), which dispatches on
`data-act` attributes.

Every `data-act` in the markup must have a matching `a === "..."` branch. A
useful check before shipping:

```bash
python3 -c "
import re; h=open('index.html').read()
acts=set(re.findall(r'data-act=\"([a-zA-Z]+)\"',h)); hand=set(re.findall(r'a === \"([a-zA-Z]+)\"',h))
print('no handler:',sorted(acts-hand),'| unused:',sorted(hand-acts))"
```

### State shape

```js
S = {
  exercises: [{ id, name, group, mode, note }],   // mode: "both" | "each"
  routines:  [{ id, name, days:[0-6], items:[{ exercise, sets, reps }] }],
  sessions:  [{ id, date:"YYYY-MM-DD", start, routine, sets:[], 
                extra:[], skip:[], targets:{}, order:[] }],
  weights:   [{ date, kg }],
  settings:  { rest, sound, ticks, vibrate, unit }
}
```

Set: `{ id, ex, side, w, reps, t }` where `side` is `"both"` or `"pair"`.
`"L"`/`"R"` appear in old data from before per-hand sets were merged — they
still render and still count as one hand each. Don't migrate them; the history
is honest as it stands.

Session fields beyond `sets` are per-day overrides of the routine:
`extra` (exercises added that day), `skip` (routine exercises dropped),
`targets` (per-day sets/reps overrides), `order` (per-day exercise order).
`dayItems()` collapses all of that back into routine items — it's what
"Update routine" and "Save as new routine" both write.

`GROUPS` drives the muscle-group pickers, the library grouping and the Stats
donut. Adding a group means adding a colour to `ZONE_COLOR` too.

### Where the data lives

`localStorage`, keyed to the exact origin. The storage layer also supports a
`window.storage` shim used when the file was previewed inside Claude; on
GitHub Pages it's plain `localStorage`.

Consequences worth remembering when advising the user: different URL means
different data, clearing site data erases the history, and there is no backup.
Settings → Export/Import JSON is the only migration path.

---

## Things that are the way they are for a reason

**Per-hand volume doubles.** `volume()` returns `w * reps * 2` for `side:
"pair"`. The user enters the weight in one hand; both hands count. The set chip
shows the arithmetic (`7.5×10 ×2 = 150`) so the totals are never mysterious.

**The rest timer is the most important feature in the app.** It must fire
reliably with the screen locked and the phone in a pocket. Three mechanisms
keep it honest, and all three were added in response to a real failure:

- Beeps are pre-scheduled on the `AudioContext` clock, not on `setTimeout`,
  so Android throttling can't delay them.
- `Timer.resync()` runs a few times a second and re-queues the beeps whenever
  the audio clock and the wall clock disagree by more than 120 ms. Android
  suspends audio with the screen off and the audio clock falls behind; this
  was a real ~1 s lag in practice.
- The alarm is aimed early by `outputLatency` to compensate for speaker and
  Bluetooth delay, and `finish()` fires immediately as a backstop if the
  countdown reaches zero with the queued alarm unplayed.

Audio needs one real user gesture before it works on mobile — `Timer.unlock()`
runs on any tap, and Settings has a "Test the alarm" button for a cold start.

**The timer is suppressed when back-filling old days, but not across
midnight.** `isLive()` allows yesterday's session to keep the timer if a set
was logged within 3 hours. Training past 00:00 is normal for this user, and
the naive "is the viewed day today?" check silently killed the timer at
midnight. Boot also reopens yesterday's session if it's still live, so one
workout doesn't split across two dates.

**Sheets use `dvh`, not `vh`.** On Android `vh` measures the viewport with the
URL bar hidden, so `88vh` overflowed the screen and cut off the Save button.

**`.btn.pickbtn` exists to beat `.btn.wide` on specificity.** Same-specificity
CSS resolves by order; this was a real bug where a picker rendered taller than
the buttons around it. Related: the desktop `@media` block sits last in the
stylesheet for exactly this reason — when it sat mid-file, the mobile
`#sheetbox` rule won and threw the dialog off-screen.

**No native `<select>` anywhere.** Android renders them as white system
dialogs that break the dark theme. The `picker()` function builds an in-sheet
list instead. Don't reintroduce `<select>`.

---

## Testing

There is no browser in the environment this was built in, so testing is done
by stubbing a minimal DOM and calling the render functions directly. The
pattern, if you need it:

- Stub `document`, `window`, `localStorage`, `requestAnimationFrame` etc.
- Extract the `<script>` body with a regex, `eval` it, and expose internals
  through a `global.__app = {...}` line appended to the source.
- Assert on the returned HTML string: balanced `<div>` counts, expected
  counters, correct ordering.

Timer drift was tested with a fake `AudioContext` whose clock deliberately
lags, and the midnight rollover with a patched `Date.now()`. Both are worth
repeating if you touch those areas.

Minimum before shipping: `node --check` on the extracted script, balanced CSS
braces, and the `data-act` audit above.

---

## Open threads

**Sync.** The user wants to plan routines on desktop and log on the phone.
Nothing is built yet. Two routes were discussed: a GitHub gist as a JSON store
(no server, ~150 lines, token in `localStorage`, secret gist is unlisted not
private), or a real backend on a home server. Every record already has an `id`;
the missing pieces are an `updatedAt` per record and tombstones for deletes,
without which deleted items resurrect from the other device.

**Home server.** The user is planning to buy a used mini PC (Lenovo/Dell Tiny,
16 GB) as a general test box, with Debian + Tailscale + Docker. The sync
backend would live there. Agreed to build sync only after the hardware exists
and gets used.

**Known rough edge.** Exercises created before muscle groups mattered may sit
in the wrong group, which skews the Stats donut. It's a data cleanup for the
user, not a code fix.

---

## Working style that fits this project

- The user tests on a real phone and sends screenshots; expect precise visual
  feedback and treat it as authoritative over any assumption made here.
- Say plainly when something can't be verified without a device.
- Design preferences are deliberate and often about removing things. When
  asked to delete an element, delete it rather than relocating it.
- Direct communication, no filler.
