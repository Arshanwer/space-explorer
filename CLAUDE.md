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

## Phone link (claude.ai Artifact)
- `npm run build:link` → `dist-link/space-explorer.html` (the page) plus its files; `dist-link.json` lists what to publish next to the page.
- That host serves only web file types and wraps the page in its own `<html>`: models ship as base64 `models/*.glb.txt` (`VITE_PACKED_MODELS=1`), no service worker, no offline files. Per publish: ≤64 MB, ≤255 files, ≤15 MB per binary, ≤16 MB per text file.
- Published privately at https://claude.ai/artifact/LRE9q4CU1SZvpyyESwQGZb — update that one rather than making a new link.
