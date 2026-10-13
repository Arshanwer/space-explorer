# Space Explorer

A free-roam solar system for kids (made for an iPad and readers aged 6–8). Real planet maps, real NASA shapes for asteroids and spacecraft, planets you can break open to see inside, and a Space Station you can float through.

## Play it on the iPad

The iPad and this Mac need to be on the same Wi-Fi.

```bash
cd ~/Personal\ Projects/space-explorer
node serve.mjs
```

It prints two addresses. Open the **On the iPad** one in Safari, then tap **Share → Add to Home Screen** so it opens full screen like an app. Keep the Terminal window open while playing; press Ctrl+C to stop.

Double-clicking `start.command` does the same thing. If macOS says it doesn't have permission, run `chmod +x start.command` once.

### Playing with no internet

Safari only lets a website save itself for offline use when it comes from a secure (`https://`) address, so the Wi-Fi option above can't do it. Put the `dist` folder on any static HTTPS host, for example:

- S3 + CloudFront: upload `dist/`, default root object `index.html`
- Netlify Drop: drag the `dist` folder onto app.netlify.com/drop
- GitHub Pages

Open that address on the iPad, then tap **☰ → Save for no-internet use**. It downloads the whole app (about 45 MB). After that it works on a plane or in the car.

## Working on it

```bash
npm install
npm run dev      # live-reloading dev server, also reachable from the iPad on the same Wi-Fi
npm run build    # makes dist/ (what serve.mjs and hosting use)
```

Three.js 0.170, GSAP for animation, Vite for building. No other runtime libraries.

## What's in it

- **The Sun, 8 planets, Pluto, 11 moons, Ceres** with real surface maps. Planets start where they really are in the sky today and orbit from there.
- **Real shapes** for Vesta, Eros, Bennu, Itokawa, Phobos and Deimos (NASA shape models), plus NASA's Space Station and Hubble models.
- **Look inside**: the planet splits open like an orange and the wedge floats away to show the layers. Every world with known layers has one (the Sun, all planets, Pluto, the Moon and Europa). Tap a layer to learn what it is.
- **Space Station inside**: float from the US lab down to Japan's Kibo lab, past the crew's sleeping pods, the kitchen, treadmill and toilet, then down into the Cupola window with Earth below.
- **Free flying**: joystick plus drag-to-look. It slows down automatically near planets so you can't crash.
- **Asteroid belt**: a field of boulders when you visit, a dusty ring from far away.
- **About 9,000 real stars** in their true positions and colours (Yale Bright Star Catalogue).
- **Read to me** on every card, with an option to read everything out loud automatically.
- **Real sizes** switch shows how big things truly are compared to Earth.
- **Time** button: slow, fast or stopped.

### Controls

| | iPad | Computer |
|---|---|---|
| Spin around | one finger drag | mouse drag |
| Zoom | pinch | scroll |
| Visit something | tap it, its name, or the bottom bar | click |
| Fly | joystick + drag the screen, ▲▼ to go up and down | W A S D / arrows, Q/E |

## Honest notes

- Sizes and distances are squeezed so everything fits: bigger things are still bigger, but not to scale (switch on Real sizes to compare sizes).
- The Space Station interior is built from simple shapes laid out like the real modules, not a scan.
- The Earth outside the Cupola is shown a bit higher than the real station flies, so more of it fits in the window.
- The Real Solar System maps were stored upside down for a game engine. They're flipped back and checked against NASA reference maps (the Moon shows its familiar face, and Jupiter's Great Red Spot is in the south).

## Where the pictures come from

- Sun, Earth, Saturn's rings, Milky Way: Solar System Scope, CC BY 4.0 (based on NASA data). Earth day, night and clouds are the 8K set, shown at 4K.
- Venus clouds: Planet Pixel Emporium, free for non-commercial use.
- Moon, Mercury, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Charon, Ceres and the Galilean moons, Titan, Enceladus, Triton (colour and relief): Real Solar System texture pack by the KSP-RO team, **CC BY-NC-SA**, made from NASA/JPL imagery. **Non-commercial: fine for the family, not for selling.**
- Space Station, Hubble, Vesta, Eros, Bennu, Itokawa: NASA 3D Resources (public domain).
- Phobos and Deimos shapes: NASA/JPL-Caltech.
- Stars: Yale Bright Star Catalogue.
- Fonts: Fredoka and Andika (SIL Open Font License); Andika is designed for children learning to read.

## Project layout

```
src/main.js              app wiring: camera, modes (space / fly / inside / station), labels, settings
src/data/bodies.js       every place you can visit: sizes, orbits, facts, inside layers
src/scene/world.js       builds and moves the bodies, swaps in sharp maps, detail levels
src/scene/bodies3d.js    Sun, Earth, atmosphere and ring shaders; model loading
src/scene/cutaway.js     the break-apart "Look inside" view
src/scene/issInterior.js the Space Station interior
src/scene/belt.js        asteroid belt, close-up boulder field, dust ring
src/scene/stars.js       real star catalogue and Milky Way
src/controls/fly.js      joystick and drag-to-look flying
src/ui/ui.js             cards, dock, read-aloud
public/tex/sd|hd         planet maps (sd loads first; hd only for what you're looking at)
public/models            NASA models (the detailed station, iss_0 + iss_1, loads only when you visit it)
```

The iPad's graphics memory is the main limit. Only the planet you're looking at gets its 4K maps, the detailed Space Station loads only near Earth, and the picture quietly drops resolution if the frame rate falls.
