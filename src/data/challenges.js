// Photo missions: things to find and snap with the space camera.
// test(ctx) gets what is on screen when the photo is taken:
//   mode ('space', 'fly', 'inside', 'iss', 'deep', 'story', 'sky'), focus (planet id),
//   deep (deep-space place id), deepDef (its facts), stage (life-of-a-star stage), sees(id) (sky: on screen and up)

export const CHALLENGES = [
  { id: 'saturn', icon: '🪐', title: 'Saturn and its rings', hint: 'Visit Saturn and snap its rings.', test: (c) => c.mode === 'space' && c.focus === 'saturn' },
  { id: 'jupiter', icon: '🟠', title: 'Jupiter, the biggest planet', hint: 'Can you see the Great Red Spot?', test: (c) => c.mode === 'space' && c.focus === 'jupiter' },
  { id: 'earth', icon: '🌍', title: 'Home, from space', hint: 'Find Earth and take its picture.', test: (c) => c.mode === 'space' && c.focus === 'earth' },
  { id: 'inside', icon: '🔍', title: 'Inside a planet', hint: 'Break a planet open with “Look inside”.', test: (c) => c.mode === 'inside' },
  { id: 'iss', icon: '🛰️', title: 'Inside the Space Station', hint: 'Go inside the Space Station.', test: (c) => c.mode === 'iss' },
  { id: 'moon', icon: '🌙', title: 'The Moon from home', hint: 'Find the Moon in tonight’s sky (try different times).', test: (c) => c.mode === 'sky' && c.sees('moon') },
  { id: 'cross', icon: '🇳🇿', title: 'The Southern Cross', hint: 'Find it in tonight’s sky, or out among the stars.', test: (c) => c.deep === 'southerncross' || (c.mode === 'sky' && c.sees('pattern:Cru')) },
  { id: 'matariki', icon: '✨', title: 'Matariki', hint: 'The little family of stars. In winter it rises before dawn.', test: (c) => c.deep === 'matariki' || (c.mode === 'sky' && c.sees('matariki')) },
  { id: 'nursery', icon: '🌸', title: 'A star nursery', hint: 'Find a cloud where new stars are born.', test: (c) => c.mode === 'deep' && c.deepDef?.kindLabel === 'A star nursery' },
  { id: 'blackhole', icon: '🕳️', title: 'A black hole', hint: 'Dive into the middle of the Milky Way.', test: (c) => c.deep === 'sgra' || c.stage === 'blackhole' },
  { id: 'galaxy', icon: '🌀', title: 'Another galaxy', hint: 'Fly out past the Milky Way.', test: (c) => c.mode === 'deep' && c.deepDef?.kind === 'galaxy' && c.deep !== 'milkyway' },
  { id: 'deepfield', icon: '🔭', title: 'Thousands of galaxies', hint: 'Find the Hubble Ultra Deep Field.', test: (c) => c.deep === 'deepfield' },
  { id: 'supernova', icon: '💥', title: 'An exploding star', hint: 'In the life of a giant star, or what is left of one.', test: (c) => c.stage === 'supernova' || c.deep === 'crab' || c.deep === 'e0102' },
  { id: 'redgiant', icon: '🔴', title: 'A star swallowing planets', hint: 'Watch the Sun grow old in the life of a star.', test: (c) => c.stage === 'redgiant' },
];
