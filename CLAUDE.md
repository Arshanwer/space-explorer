# Space Explorer — notes for Claude Code

Kids' (6–8) solar-system explorer for iPad Safari. Vite + three.js 0.170 (pinned) + GSAP. No framework.

## Map
- `src/main.js` — renderer/composer (HalfFloat MSAA target, bloom, OutputPass with needsSwap=false), OrbitControls, the four modes (`space`, `fly`, `inside`, `iss`), camera flights, label declutter + occlusion, picking, settings, offline (service worker, prod + https only), adaptive pixel ratio.
- `src/data/bodies.js` — single source of truth: sizes (`radiusEarths`), orbits (`au`, `periodDays`, `L0` mean longitude at J2000), `faceU` (map u to turn towards camera on arrival), facts, `inside` layers (`r0`/`r1` fractions of radius).
- `src/scene/world.js` — Body objects (`group > tilt(scale = radius) > spin > mesh`), HD map swapping (ref-counted via `textures.js`), ISS detailed model load/unload, `updateView` LOD + sub-pixel culling.
- `src/scene/cutaway.js` — break-apart view; sphere slices need the UV remap in `sphereGeo` and `RepeatWrapping` maps.
- `src/scene/issInterior.js` — separate scene; hotspots are CSS2D objects (hide them by hand when switching scenes).

## Rules that matter
- iPad GPU memory is the constraint: SD maps load at start; only the focused body gets HD (`world.setHD`). Don't add always-loaded 4K maps. The detailed station (`iss_0.glb` + `iss_1.glb`, two halves) is ~600k verts / 78 MB GPU — load only near Earth.
- Real Solar System (KSP) maps were stored for Unity: vertically flipped, and some also mirrored. Orientation was verified by correlating against NASA/SSS reference maps; normal maps come from DXT5nm (X=alpha, Y=green), negate X when mirroring.
- Kid-scale: `kidRadius = r^0.6`, `kidDistance = 12 + 40·au^0.7`. Moons orbit at `parentRadius × orbitR` so Real sizes mode keeps working.
- Any camera animation must be killable (`stopCameraTweens`); mode switches go through `state.busy` during fades.
- Copy for kids: short sentences, no jargon, read-aloud friendly. Facts checked against NASA fact sheets.
- `?test` URL flag: wall-clock animations and no CSS transitions, for headless screenshot checks on the software renderer.
- Models go through `loadGLTF` (src/scene/bodies3d.js), never `gltfLoader.load` directly. Model pictures decode via `<img>` (a GLTFLoader plugin), because strict hosts refuse `fetch()` of `blob:` addresses.

## Deep space (src/deep, loaded on first use)
- Two scenes, one camera. Solar system = kid units, ecliptic frame. Deep space = light-years, Sun at 0, galactic frame (x to the centre of the Milky Way, y galactic north). `frames.js` holds the exact rotations; the Milky Way photo sphere uses them in both scenes.
- Handoff: zoom out to `HANDOFF_D` (5000) in the solar system → `enterDeepScene` puts the deep camera at `Z_HANDOFF` (0.004 ly) along the same direction with up = ecliptic north mapped to deep. The two frames are pixel-identical at that moment (tested: 25/25 bright stars within 4 px). Up then blends to galactic north by Z ≈ -0.3 (`upForZ`, a pure function of Z so flights can be interrupted).
- `Z` = log10(camera-to-target distance in ly). Fades are all functions of Z in `applyScale`: photo 3.35–4.05, stars 3.55–4.3, galaxy 3.4–4.0. Above Z≈3.9 the orbit target slides to the galactic centre.
- Star brightness is computed per star on the GPU from absolute magnitude and camera distance (`starfield.js`), with gentle compression and an "eye adjusts" shift when far out. At Z_HANDOFF it equals stars.js exactly.
- Galaxy: arms map painted once on the GPU (`ARMS_FRAG`), ray-marched into a reduced-size half-float target only when the camera moves (`cacheKey`), then composited with premultiplied "over". Auto exposure reads the smallest mip of that target; looking along the disc is capped by `uEdgeCap`. Sparkle/nursery/cluster points use the same exposure.
- Arms follow Reid et al. 2019 near the Sun (Perseus 10.1 kpc, Sgr–Car 6.9, Scutum 5.0 at the Sun's azimuth); `armPoint()` gives label positions.
- Kid copy for every place lives in `src/data/deep.js`. Check facts before changing numbers.

## Galactic centre and black hole (src/deep/galcentre.js, gcData.js, blackhole.js, photonTable.js)
- Everything near Sgr A* lives in groups placed at `GC_POS` with small local coordinates, so it stays precise when the camera is light-minutes from the hole (the camera itself is in doubles). Shaders there use `modelViewMatrix`, never world positions. Rays from `uProjInv` go through the near plane (z = -1): with near = 1e-7 the far-plane maths collapses in float32.
- Units next to the hole: M = G·mass/c² (`M_LY`); event horizon at 2M. Mass 4.297e6 Suns, S-star orbits from GRAVITY 2022 (table in gcData.js; others are made-up but plausible). Sky directions at the centre (`SKY_N/E/L`) turn orbital elements into 3D.
- Light bending is a post pass (`BlackHoleLens`, inserted after the RenderPass): for each pixel it finds the photon's plane, looks the path up in `photonTable.js` tables (u(ψ) and ψ(u) for 512 impact parameters, built once in ~0.1 s; exact closest approach from the cubic), shades disc crossings (Doppler + gravity shift, g³) and samples the background either from this frame's picture (if the bent direction is on screen) or from a cube map taken at the centre (`captureEnv`, released on leaving). Far rays (b > 400) use a first-order formula. Validated against direct integration (≤ 1 px).
- The scene is drawn into the composer's `renderTarget2` (its starting readBuffer, MSAA). The pass writes into `renderTarget1` (made non-MSAA in main.js, unused otherwise) and swaps; main.js swaps back after `composer.render` so every frame starts in the MSAA buffer. `renderer.compile` only matches the real shaders if a render target is bound (see `warmUp`). A render target's scissor is applied when it's bound, so set it before `setRenderTarget`.
- Near the centre the galaxy's exposure is held fixed (`uExpoFix/uExpoMix`) so the live picture and the cube map match. "Up" turns to the disc's spin axis (`DISK_N`) below Z ≈ -3, as a pure function of Z.
- Telescope view = radio-like emissivity, blurred to the EHT's 20 µas beam relative to the ring, EHT colour map. The card picture `public/tex/eht/sgra.jpg` was reconstructed from EHT public data (see README).

## Real pictures, galaxies, deep field (src/deep/photos.js, universe.js, src/data/astro.js) — stage 3
- Pictures come from `scripts/astro-prep.py` (sources listed in `scripts/astro-sources.json`): 3D version with sky level removed and edges/black corners faded (additive blending, so black = nothing), `sm/` 512 px version used until the thing is big on screen, `card/` as published, `thumb/` round dock pictures. Only the focused/large picture gets its full texture; everything is let go when tiny or on leaving deep space.
- Nebulae hang in the sky plane facing the Sun, turned so galactic north is up. Past ~260 px wide they also get a cloud of dots built from the small picture (`buildCloud`, depth models bowl/cloud/shell/ball); the flat picture fades out as you look from the side or get close (it would look like a wall).
- Disc galaxies are laid on a plane at their real tilt (position angle + inclination); UVs are worked back to the sky so the Earth view matches the photo exactly. Andromeda's texture is cut to its oval (no streaky foreground stars). Edge-on/ball galaxies are sprites rotated to keep their long axis/north fixed in space.
- Catalogue galaxies: Celestia `galaxies.dsc`, packed 12 bytes each. Celestia's orientation = rotation⁻¹·(0,1,0) in its ecliptic frame (checked on 12 galaxies). Instanced quads: tiny ones become soft dots with a flux-ish fade, resolved spirals lie at their real tilt, ones with their own photo hand over to it.
- Deep field: HUDF cut-outs (atlas + positions in `src/data/deepfield.json`) in a 20 Mly cone at 1.2 Gly in the real direction; from the cone's tip it is exactly the photo. Depth from faintness + redness, squeezed (said on the card).
- Far out (Z > ~6.2 from the galaxy's middle) the Milky Way swaps to a flat picture of itself made once by the ray marcher from above (`galaxy.makeFarDisc`). Galaxies get an "eye adjusts" boost with zoom.

## Life of a star (src/scene/starStory.js, src/data/starLife.js)
- Its own scene (mode `story`), opened from the Sun's card, the deep dock or chips; leaving restores the exact camera and mode (or flies to a real example). The planets' `sky` group is borrowed while it's open. Other scenes' CSS2D labels are hidden by hand on the way in and out.
- One star is tweened between stages; each stage is framed with the star at radius 1, and true sizes are shown by zooming out as it grows (planet paths in units of the star). "Slice it open" reuses `Cutaway` with a stand-in body.

## Tonight's sky (src/scene/homeSky.js, ephemeris.js) — stage 4
- Mode `sky`, a side scene like the story (`openSide`/`closeSide` in main.js share the save/restore code). Local frame x = east, y = up, z = south; the observer is at the origin (Newlands, −41.22, 174.81).
- Sky things live in one group in J2000 equatorial coordinates, turned by `skyMatrix(jd, lat, lon)` (sidereal time + precession). The Moon is placed topocentrically in the local frame (it's close). Checked against astropy: < 0.08° everywhere.
- Times are NZ time (`Pacific/Auckland` via Intl). In daytime it opens at tonight's first properly dark hour (Sun below −12°, `tonightTime`) instead. Labels are CSS2D; taps use `pickAt` or the `[data-pick]` attribute on the label.
- Tilt-to-look: DeviceOrientation (permission needed on iOS, refused inside the claude.ai frame), webkitCompassHeading + 22.9° declination for true north, sideways drag nudges it. Untested on a device.

## Camera, album, quick jumps (src/ui/album.js, src/data/challenges.js)
- 📷 sets `state.snapReq`; the frame loop calls `takeSnap()` right after `composer.render` (the WebGL picture is only readable in the same frame). The photo gets a caption strip and goes to IndexedDB (falls back to memory). Photo missions are tested against `snapInfo().ctx`.
- "Go to…" (`JUMPS` in main.js) closes a side scene first if needed; jumping to a planet from deep space goes via `state.afterHome`.

## Phone link (claude.ai Artifact)
- `npm run build:link` → `dist-link/space-explorer.html` (the page) plus its files; `dist-link.json` lists what to publish next to the page.
- That host serves only web file types and wraps the page in its own `<html>`: models ship as base64 `models/*.glb.txt` (`VITE_PACKED_MODELS=1`), no service worker, no offline files. Per publish: ≤64 MB, ≤255 files, ≤15 MB per binary, ≤16 MB per text file.
- Published privately at https://claude.ai/artifact/LRE9q4CU1SZvpyyESwQGZb — update that one rather than making a new link.
