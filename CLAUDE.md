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

## Phone link (claude.ai Artifact)
- `npm run build:link` → `dist-link/space-explorer.html` (the page) plus its files; `dist-link.json` lists what to publish next to the page.
- That host serves only web file types and wraps the page in its own `<html>`: models ship as base64 `models/*.glb.txt` (`VITE_PACKED_MODELS=1`), no service worker, no offline files. Per publish: ≤64 MB, ≤255 files, ≤15 MB per binary, ≤16 MB per text file.
- Published privately at https://claude.ai/artifact/LRE9q4CU1SZvpyyESwQGZb — update that one rather than making a new link.
