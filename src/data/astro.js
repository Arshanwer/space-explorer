// Where the real astronomy pictures go in 3D (deep-space frame, light-years).
// Positions are J2000 right ascension / declination (degrees) and distance (ly).
// w = width of the picture in light-years (from the telescope's field of view at that distance),
// asp = height / width of the picture.
//
// model: how the flat picture is given depth when you fly round it
//   bowl   a cloud hollowed out towards us (the Orion Nebula is a "blister" on the front of a dark cloud)
//   cloud  a lumpy slab; brighter, puffier parts are thicker
//   shell  a hollow bubble (gas puffed off by a dying star): the ring is the bubble's edge
//   ball   a filled ball (what's left of an exploded star)
//   disc   a flat galaxy, tipped to its real tilt (pa = position angle, inc = tilt from face-on).
//          The picture is "un-squashed" onto the disc, so from Earth it looks exactly like the photo.
//          ix/iy = galaxy centre in the picture (0..1 from the top left), iang = angle of its long
//          axis in the picture (degrees, clockwise from right); ell = [half-length, short/long ratio]
//          of the oval the galaxy was cut out to (only the disc inside it is drawn)
//   edge   a galaxy seen side-on: the picture turns round its long axis to face you
//   ball2  a galaxy shaped like a ball: the picture always faces you
// anchor: where in the picture (0..1 from the top left) the real position is, if not the middle

export const PHOTO = {
  orion: { ra: 83.8221, dec: -5.3911, dist: 1344, w: 12, asp: 1152 / 2048, model: 'bowl', depth: 0.2, gain: 1.15 },
  horsehead: { ra: 85.2458, dec: -2.4583, dist: 1375, w: 3, asp: 1200 / 1148, model: 'cloud', depth: 0.16, gain: 1.15 },
  eagle: { ra: 274.70, dec: -13.84, dist: 6500, w: 5.3, asp: 1183 / 1200, model: 'cloud', depth: 0.2, gain: 1.1 },
  carina: { ra: 159.33, dec: -58.62, dist: 7600, w: 20, asp: 1186 / 2048, model: 'cloud', depth: 0.22, gain: 1.05 },
  mystic: { ra: 161.0, dec: -59.5, dist: 7500, w: 4, asp: 1105 / 1200, model: 'cloud', depth: 0.2, gain: 1.05 },
  crab: { ra: 83.6331, dec: 22.0145, dist: 6500, w: 13, asp: 1, model: 'ball', r: 0.44, gain: 1.15 },
  ring: { ra: 283.396, dec: 33.029, dist: 2600, w: 1.8, asp: 1215 / 1190, model: 'shell', r: 0.36, squash: 0.9, gain: 1.05 },
  helix: { ra: 337.4106, dec: -20.8371, dist: 650, w: 7, asp: 1280 / 2048, model: 'shell', r: 0.28, squash: 0.75, gain: 1.15 },
  southernring: { ra: 151.757, dec: -40.4365, dist: 2500, w: 1.6, asp: 1490 / 1600, model: 'shell', r: 0.3, squash: 0.8, gain: 1.05 },
  tarantula: { ra: 84.6758, dec: -69.1008, dist: 161000, w: 340, asp: 1185 / 2048, model: 'bowl', depth: 0.22, gain: 1.05 },
  n159: { ra: 84.95, dec: -69.77, dist: 161000, w: 130, asp: 900 / 1600, model: 'cloud', depth: 0.2, gain: 1.0 },
  e0102: { ra: 16.0083, dec: -72.0314, dist: 199000, w: 450, asp: 961 / 1200, model: 'cloud', depth: 0.12, anchor: [0.42, 0.78], gain: 1.0 },

  andromeda: { ra: 10.6847, dec: 41.2690, dist: 2.54e6, w: 160000, asp: 1360 / 2048, model: 'disc', pa: 38, inc: 77, ix: 0.4929, iy: 0.4542, iang: -36.6, ell: [0.45, 0.33], gain: 1.3 },
  triangulum: { ra: 23.4621, dec: 30.6599, dist: 2.73e6, w: 19000, asp: 1000 / 779, model: 'disc', pa: 23, inc: 55, ix: 0.612, iy: 0.571, iang: 74, gain: 1.4 },
  whirlpool: { ra: 202.4696, dec: 47.1952, dist: 3.1e7, w: 146000, asp: 1280 / 2048, model: 'disc', pa: 163, inc: 22, ix: 0.402, iy: 0.472, iang: 0, gain: 1.1 },
  pinwheel: { ra: 210.8023, dec: 54.3489, dist: 2.1e7, w: 190000, asp: 1001 / 1280, model: 'disc', pa: 40, inc: 18, ix: 0.49, iy: 0.52, iang: 0, gain: 1.15 },
  sombrero: { ra: 189.9976, dec: -11.6231, dist: 3.0e7, w: 69000, asp: 1280 / 2048, model: 'edge', pa: 90, gain: 1.05 },
  cena: { ra: 201.3651, dec: -43.0191, dist: 1.2e7, w: 9000, asp: 1336 / 1600, model: 'ball2', gain: 0.9 },
  m87: { ra: 187.7059, dec: 12.3911, dist: 5.5e7, w: 35000, asp: 1, model: 'ball2', gain: 1.2 },
};

// The two Magellanic Clouds have no wide photo to use, so they're built from points: a bar,
// a lumpy disc of stars and pink star nurseries, at their real places, sizes and tilts.
export const CLOUDS = {
  lmc: { ra: 80.8939, dec: -69.7561, dist: 160000, r: 7000, inc: 34, pa: 170, bar: [3300, 900], seed: 11, points: 26000 },
  smc: { ra: 13.1867, dec: -72.8286, dist: 199000, r: 3800, inc: 65, pa: 45, bar: [2200, 700], seed: 23, points: 14000 },
};

// The Hubble Ultra Deep Field: its real direction on the sky
export const DEEP_FIELD = { ra: 53.1625, dec: -27.7914, dist: 1.2e9, length: 2.2e7, halfAngle: 20 };
