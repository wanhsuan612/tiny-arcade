# Mochi Sky / 麻糬星野

A tiny pastel pixel-art side-scroller POC inside **Shem's Tiny Arcade**.

Play it from the arcade:

```text
https://shemyu.github.io/single-page-games/games/mochi-sky/
```

## What is implemented

- horizontal side-scrolling camera
- jump and platform collision
- inhale mechanic
- star projectile attack
- simple enemies
- collectibles
- health UI
- checkpoint
- finish gate
- keyboard controls
- touch controls for mobile browsers
- lightweight procedural audio
- local PNG player, inhale, enemy, star, backdrop, and terrain assets

## Controls

| Input | Action |
| --- | --- |
| `←` `→` / `A` `D` | Move |
| `Space` / `W` | Jump |
| Hold `X` | Inhale |
| `C` | Shoot star |
| `R` | Restart |
| `P` | Pause |

## POC notes

This is intentionally compact: one HTML page with embedded CSS, JavaScript, canvas rendering, and a few local PNG textures. The goal is to validate feel and interaction before introducing a framework.

## Asset pipeline

Runtime scene art is deliberately split by responsibility:

- `mochi-sky-backdrop.png` contains only distant sky, clouds, hills, trees, and valley mist.
- `mochi-sky-tiles.png` contains the foreground grass/dirt tile and is horizontally seamless.
- `mochi-sky-inhale-game-sheet.png` is an eight-frame sheet with fixed 96×64 cells and one shared foot baseline. Frames 5–7 form the held-inhale loop.

This avoids baking foreground terrain into one large scene image, which made pits ambiguous and made the terrain impossible to repeat cleanly. The original generated source images remain useful as visual references, but no longer define the runtime backdrop, terrain, or inhale motion.

Regenerate all runtime assets with:

```bash
python3 tools/generate_assets.py
python3 tools/normalize_generated_art.py
```

`normalize_generated_art.py` first rebuilds the deterministic scene and inhale assets, then normalizes the optional generated Mochi, enemy, and star sheets. Generated animation frames share one scale and one contact baseline, so they do not grow, shrink, or bounce because of per-frame tight cropping.
