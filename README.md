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
- **Out to the stars** (new): keep pinching out past the planets, or tap the ladder on the left, and the solar system shrinks to a dot. Then come the nearest stars (Alpha Centauri, Sirius, Barnard's Star…), the bright star neighbours (Betelgeuse, Rigel, Matariki), and finally the whole **Milky Way** with a "You are here" marker. Every star is in its real place (about 43,000 of them), so constellations change shape as you fly. Try the Southern Cross: it starts as the pattern on the flag, then falls apart when you fly around it.
- **The Milky Way** is drawn the way astronomers have measured it: a central bar, two big arms (Scutum–Centaurus and Perseus), two smaller ones, and the little Orion Spur where the Sun lives, with dust lanes and pink star nurseries. Look at it from above, from the side, or from inside.
- **The black hole** (new): dive into the middle of the galaxy, through the crowded "star city" and its dusty ring, past the S-stars racing round on their real measured orbits (S2 goes round every 16 years), down to Sagittarius A* itself. Its picture is worked out with real physics: light bends round the hole (you can see the back of the glowing disc curled over the top), the side of the disc rushing towards you is brighter and bluer, and light that comes too close never gets out. **Light beams** shows what happens to light passing the hole; **Telescope view** shows it the way the Event Horizon Telescope sees it from Earth, next to a real picture made from that telescope's measurements.
- **Real space pictures in 3D** (new): the Orion Nebula, Horsehead, Pillars of Creation, Carina's Cosmic Cliffs and Mystic Mountain, the Crab Nebula (with its spinning pulsar), the Ring, Helix and Southern Ring nebulae, and the Tarantula Nebula, all from Hubble and Webb, hung in their real places. From home they look exactly like the photos; fly round one and it turns into a 3D cloud made from the picture's own colours (a hollow bubble for a dying star's gas, a bowl for Orion).
- **Galaxies** (new): two more rungs on the ladder. **Galaxy neighbours** shows the Milky Way, Andromeda, Triangulum and the two Magellanic Clouds; **Galaxies everywhere** shows nearly 11,000 real galaxies in their real places, with crowds like the Virgo Cluster. Andromeda, Triangulum, the Whirlpool, Pinwheel and Sombrero galaxies, Centaurus A and M87 are real photos, tipped to their real tilts.
- **The Hubble Ultra Deep Field** (new): every one of its 1,700-odd galaxies was cut out of the real picture and spread out in depth, so you can fly in among them (tap **Fly through it**).
- **The life of a star** (new): two stories, a star like our Sun and a giant star, from a cloud of gas to a white dwarf, or to a supernova, a neutron star or a black hole. Watch the Sun swell into a red giant and swallow Mercury and Venus, **slice open** a star at each stage (including a neutron star's "nuclear pasta"), and tap **See a real one** to fly to a real example. Open it from the Sun's card or the first button in the deep-space bar.
- **Tonight's sky from home** (new): stand in Newlands, Wellington, and look up at the real sky right now (or tonight, if it's daytime): every star you can see with your eyes, the Milky Way, the Moon in its real phase, and the planets where they really are, worked out for the exact moment. Star patterns can show the usual names or **Māori names** (Matariki, Māhutonga, Puanga, Rehua, Te Waka o Tamarereti…). **Watch it turn** speeds time up so the sky wheels round the south celestial pole. **Move to look** uses the iPad's motion sensors and compass, so you can hold it up to the real sky. Tap anything to find out what it is and where to look, and fly to it. Open it from Earth's card or **Go to…**.
- **The space camera** (new): the 📷 button takes a photo of whatever you're looking at (with a caption saying what it is) and keeps it in **My photos**, on the iPad. There are 14 **photo missions** to complete (Saturn's rings, the Moon from home, a black hole, an exploding star…). Photos can be shared from the album, or pressed and held to save them.
- **Go to…** (new): one button that jumps straight to the favourite places (Earth, tonight's sky, the nearest stars, a star nursery, the black hole, Andromeda, the deep field, the life of a star, My photos).

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
- The black hole's glowing disc is brighter and neater than the real one: Sagittarius A* only nibbles a little gas, and its glow is a faint, puffy haze best seen with radio telescopes. Everything else about how its light bends is worked out properly.
- Close to the galactic centre, time is sped up (a year a second for the S-stars, about 300 times for the disc) so you can see things move.
- The real space pictures are flat photos; the 3D clouds you see when flying round them are a best guess at their shapes made from the photos, not measurements. Nebula pictures are turned so the galaxy's "up" is at the top.
- The Magellanic Clouds have no wide photo here, so they're built from dots at their real places, sizes and tilts.
- Far-off galaxies are shown a little brighter than they'd really look, so you can find them. Galaxies without their own photo borrow a picture of a galaxy of the same kind.
- In the deep field fly-through, galaxies that are really spread over billions of light-years are squeezed closer together (the card says so).
- In the life of a star, the middles of giant stars are drawn much bigger than they really are so you can see the layers.
- In tonight's sky the Moon is drawn 4 times bigger than it looks, so you can see its phase; the hills are made up (but low towards the city and harbour, like the view from Newlands). Positions of the Sun, Moon and planets are within about a tenth of a degree (checked against astropy).
- "Move to look" lines up with north using the iPad's compass (corrected for Wellington's 23° compass difference). It hasn't been tried on a real iPad yet; if it's a bit off, drag sideways to line it up. It needs the real website (the private claude.ai link can't use the motion sensors).
- Photos are kept in the browser on this iPad only. Clearing Safari's website data deletes them.
- The Real Solar System maps were stored upside down for a game engine. They're flipped back and checked against NASA reference maps (the Moon shows its familiar face, and Jupiter's Great Red Spot is in the south).

## Where the pictures come from

- Sun, Earth, Saturn's rings, Milky Way: Solar System Scope, CC BY 4.0 (based on NASA data). Earth day, night and clouds are the 8K set, shown at 4K.
- Venus clouds: Planet Pixel Emporium, free for non-commercial use.
- Moon, Mercury, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Charon, Ceres and the Galilean moons, Titan, Enceladus, Triton (colour and relief): Real Solar System texture pack by the KSP-RO team, **CC BY-NC-SA**, made from NASA/JPL imagery. **Non-commercial: fine for the family, not for selling.**
- Space Station, Hubble, Vesta, Eros, Bennu, Itokawa: NASA 3D Resources (public domain).
- Phobos and Deimos shapes: NASA/JPL-Caltech.
- Stars: Yale Bright Star Catalogue.
- Stars in 3D: the HYG database v4.1 by David Nash (astronexus), CC BY-SA 4.0. `src/data/starsNear.js` is a derived subset made by `scripts/hyg-to-js.py` and shares that licence.
- Milky Way arm shapes: maser parallax measurements by Reid et al. (2019), carried round the far side.
- The black hole picture in its card: reconstructed from the Event Horizon Telescope's public 2017 measurements of Sagittarius A* (EHT Collaboration 2022, public domain data) with the EHT's own eht-imaging pipeline, averaging 79 of its "top set" settings. The ring measures 52 µas, matching the published 51.8 ± 2.3 µas. It is a reconstruction made from the same data, not the press image itself.
- S-star orbits (S2, S29, S38, S42, S55, S60) and the black hole's mass: GRAVITY Collaboration (2022). The other S-stars in the swarm are on made-up orbits of the same kind.
- The black hole's light-bending: worked out exactly for a non-spinning black hole (the real one probably spins, which changes the shape only a little).
- Hubble and Webb pictures: NASA, ESA, CSA and STScI (public domain; ESA/Hubble's N159 picture is CC BY 4.0), with the image teams named in the app's credits. The full list of where each one came from (and its credit line) is in `scripts/astro-sources.json`; a few credit lines were matched by recognising well-known releases and are worth re-checking against the official pages.
- Andromeda photo: Guillermo Ferla on Unsplash (Unsplash License).
- M87's black hole picture: reconstructed from the Event Horizon Telescope's public M87 data, the same way as Sagittarius A*'s.
- The 11,000 galaxies: Celestia's `galaxies.dsc` (GPL-2.0-or-later; from the Revised NGC/IC catalogue by W. Steinicke, Karachentsev et al. 2004, NED and RC3). `src/data/galaxies.json` is derived from it by `scripts/astro-prep.py` and shares that licence. Their tilts follow Celestia's orientations (checked against M31, M33, M81, NGC 891 and NGC 4565).
- Star patterns: Stellarium's sky cultures (modern and Māori; Māori names for planets from Te Ara). `scripts/sky-prep.py` builds `src/data/skyLines.json` from them and the HYG database.
- Sun, Moon and planet positions: NASA JPL's approximate planet elements (E.M. Standish) and Paul Schlyter's Sun and Moon method, with precession; `src/scene/ephemeris.js`.
- `scripts/astro-prep.py` turns the source pictures into the app's versions (edges faded, foreground stars taken out of Andromeda, deep-field galaxies cut out and packed).
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
src/deep/                deep space: frames.js (how the solar system, star catalogue and galaxy line up),
                         starfield.js (43,000 real stars), galaxy.js (the Milky Way), deepSpace.js (camera, labels, trips),
                         galcentre.js + gcData.js (star city, dusty ring, S-stars), blackhole.js + photonTable.js (light bending),
                         photos.js (real nebula and galaxy pictures in 3D, Magellanic Clouds), universe.js (11,000 galaxies, deep field)
src/scene/starStory.js   the life of a star (its own little scene)
src/scene/homeSky.js     tonight's sky from home; ephemeris.js works out where the Sun, Moon and planets are
src/ui/album.js          the space camera's photo album and photo missions (src/data/challenges.js)
src/data/deep.js         stars and galaxy places you can visit, with their facts; the zoom ladder
src/data/astro.js        where each real picture goes in 3D, and how it's given depth
src/data/starLife.js     the life-of-a-star stories and the layers inside each kind of star
public/tex/astro         real pictures: 3D versions, small versions, card pictures, round dock pictures, deep-field and galaxy atlases
public/tex/sd|hd         planet maps (sd loads first; hd only for what you're looking at)
public/models            NASA models (the detailed station, iss_0 + iss_1, loads only when you visit it)
```

The iPad's graphics memory is the main limit. Only the planet you're looking at gets its 4K maps, the detailed Space Station loads only near Earth, and the picture quietly drops resolution if the frame rate falls.
