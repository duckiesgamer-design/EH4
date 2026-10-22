# Wildbound — 3D Survival

A browser-based 3D survival game prototype built with Three.js. It is designed to run on desktop and mobile browsers and can be hosted free with GitHub Pages.

## Features

- 3D forest, rocky coast, fog, changing day/night lighting, and campfire
- First-person controls on desktop
- Touch look controls and virtual movement joystick on mobile/tablet
- Health, hunger, thirst, stamina, resource inventory
- Gather stone and berries; build a campfire from resources
- Pause/restart menus and survival HUD

## Controls

### Desktop
- **W A S D** or arrow keys: move
- **Mouse**: look around (click the game to lock the pointer)
- **Shift**: sprint
- **Space**: jump
- **E**: collect a nearby resource / eat berries if no resource is nearby? Use the Eat berries button for food.
- **Q**: drink water
- **F**: build a campfire
- **Esc**: pause / resume

### Mobile and tablet
- Left joystick: move
- Drag the world view: look around
- **E** button: collect nearby resources
- **⇧** button: sprint while held
- **↑** button: jump
- HUD buttons: eat berries, drink water, build campfire

## Play locally

Because this project uses JavaScript modules, open it through a local web server rather than double-clicking `index.html`.

Easy option with Python installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Publish on GitHub Pages

1. Create a GitHub account at https://github.com if needed.
2. Create a new **public** repository, for example `wildbound-survival`.
3. Upload `index.html`, `style.css`, `game.js`, and `README.md` to the repository root.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose branch **main** and folder **/(root)**, then press **Save**.
7. Wait a minute or two. GitHub will show the published URL, usually:
   `https://YOUR-USERNAME.github.io/wildbound-survival/`

Open that URL on your phone, tablet, or computer. Three.js is loaded from jsDelivr, so the first load needs an internet connection.

## Notes / next steps

This is a playable prototype, not a finished AAA survival game. It uses simple low-poly 3D models rather than scanned realistic assets. A good next iteration would add real collision geometry, tool/weapon crafting, water refill interactions at the coast, save games, sound, animals, and better terrain/vegetation.


Mobile: use the left joystick to move, drag the right side to look, and use the on-screen action buttons. Interior surfaces use procedural tile, wood and concrete textures.
