# Plates

A strength training log that runs in the browser. No account, no server, no
network needed after the first load. Everything is stored on the device that
opens it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app. Markup, styles and logic in one file. |
| `manifest.json` | Tells Android the name, icon and that it opens full screen. |
| `sw.js` | Service worker. Caches the app so it works offline. |
| `icon-192.png`, `icon-512.png` | Home screen icons. |
| `icon-maskable.png` | Icon for launchers that crop to a circle or squircle. |

Keep all six in the same folder. The paths inside are relative, so the folder
can live anywhere as long as it stays together.

## Putting it online with GitHub Pages

You need a GitHub account. Everything below is free.

### With git on your computer

```bash
cd plates-app
git init
git add .
git commit -m "Plates"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/plates.git
git push -u origin main
```

Create the empty `plates` repository on GitHub first, and make it **public** —
Pages needs a public repo on the free plan.

### Without git

On github.com: New repository, name it `plates`, public, create. Then
"uploading an existing file" and drag all six files in. Commit.

### Turn on Pages

Repository → Settings → Pages → Source: "Deploy from a branch" → Branch:
`main`, folder `/ (root)` → Save.

Give it a minute or two. Your address will be:

```
https://YOUR-USERNAME.github.io/plates/
```

## Installing it on the phone

1. Open that address in Chrome on Android.
2. Menu (⋮) → **Install app**, or **Add to Home screen**.
3. It appears with its own icon and opens with no browser bar.

If "Install app" doesn't show, the page hasn't registered the service worker
yet. Reload once and check again.

## Updating it later

Edit `index.html`, then **change the `VERSION` string at the top of `sw.js`**
— for example `plates-v1` to `plates-v2`. Commit and push both.

Without that bump, phones keep serving the cached old copy and your change
never appears. This trips up everyone once.

## About your data

Your sets live in the browser's `localStorage`, tied to the exact web address
the app was opened from.

- Different address means different data. Moving from a local file to the
  Pages URL starts you empty.
- Clearing Chrome's site data for that address erases the history.
- There is no backup anywhere else.

So: **Settings → Export data as JSON**, occasionally. Import on the other side.
Do this before switching phones or browsers, and after any session you would be
annoyed to lose.

## Changing things

The app is one file, in three parts:

- `<style>` — colours as CSS variables at the top, then layout.
- The markup — header, tab bar, the timer overlay, and an empty `<main>`.
- `<script>` — state, rendering, timer, storage.

The whole thing runs on one pattern: everything lives in the object `S`, a tap
changes `S`, then `save()` writes it and `render()` redraws the screen from
scratch. To add a field, put it in `S`, draw it in the matching `render*`
function, and handle its tap in the big click listener at the bottom.
