# Playing with Paradoxes

An interactive website visualizing famous mathematical paradoxes, built as the applied
final project for **Milestones of Mathematical Thought** (Technion, Spring 2026)
by Or & Idor.

**Live site:** https://ormaman14.github.io/playing-with-paradoxes/

## Paradoxes

| Paradox | Status |
|---|---|
| Achilles and the Tortoise (Zeno) | ✅ Live |
| Hilbert's Hotel | 🔜 Planned |
| Russell's Paradox | 🔜 Planned |

## Running locally

This is a fully static site — no build step, no backend, no dependencies to install.

- Easiest: open `index.html` in a browser, **or**
- Serve the folder (recommended, avoids any file:// quirks):
  ```
  python -m http.server 8123
  # or
  npx http-server -p 8123
  ```
  then open http://localhost:8123

The only external resources are Google Fonts and KaTeX, loaded from CDNs.

## Project structure / adding a paradox

```
index.html              # Hub page with one card per paradox
css/style.css           # Shared design system
js/shared.js            # Shared helpers (number formatting, tick steps)
paradoxes/
  achilles/
    index.html          # Content: history, simulation, math, philosophy
    achilles.js         # Simulation logic (canvas)
docs/design-notes.md    # Running log of design decisions
```

To add a paradox: create `paradoxes/<name>/index.html` + `<name>.js`
(copy the Achilles page as a template), and turn its "coming soon" card on the
hub page into a link.

## A note on the design

The Achilles simulation computes positions **incrementally in floating point on
purpose**. After enough Zeno steps the gap rounds to exactly zero — the finite
machine "gives up" on the infinite process. This is a deliberate feature, not a
bug: it demonstrates that infinity cannot be literally simulated, which is part
of the pedagogical point (see section 4 of the Achilles page).
