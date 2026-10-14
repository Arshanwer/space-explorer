// All the places you can visit. Sizes and distances are "explorer scale":
// squeezed so everything fits on screen, but bigger things are still bigger.
// Facts are written for 6–8 year olds and checked against NASA fact sheets.

export const SUN_RADIUS = 12;

// Kid-scale radius from real radius in Earths
export const kidRadius = (re) => Math.pow(re, 0.6);
// Kid-scale distance from the Sun in AU
export const kidDistance = (au) => SUN_RADIUS + 40 * Math.pow(au, 0.7);

const tex = (name) => ({ sd: `tex/sd/${name}.jpg`, hd: `tex/hd/${name}.jpg` });
const sdOnly = (name) => ({ sd: `tex/sd/${name}.jpg` });

export const BODIES = [
  {
    id: 'sun', name: 'The Sun', kind: 'star', color: '#ffb340',
    radiusEarths: 109, realRadiusKm: 696340,
    tagline: 'Our star. It gives us light and warmth.',
    facts: [
      { icon: '☀️', text: 'The Sun is a star. It is a giant ball of hot, glowing gas.' },
      { icon: '🌍', text: 'About 1.3 million Earths could fit inside it!' },
      { icon: '⏱️', text: 'Sunlight takes 8 minutes to zoom all the way to Earth.' },
    ],
    actions: [{ id: 'story', icon: '🌟', label: 'The life of a star' }],
    inside: [
      { name: 'Surface', kid: 'The glowing part we see. Hotter than any oven on Earth.', r0: 0.97, r1: 1.0, color: '#ffd36a', glow: 0.25 },
      { name: 'Bubbling layer', kid: 'Hot gas bubbles up and sinks down, like boiling soup.', r0: 0.7, r1: 0.97, color: '#f07a1a', glow: 0.2 },
      { name: 'Glowing layer', kid: 'Light bounces around in here for thousands of years before it gets out.', r0: 0.25, r1: 0.7, color: '#d9461a', glow: 0.25 },
      { name: 'Core', kid: 'The hottest place. This is where the Sun makes its energy.', r0: 0, r1: 0.25, color: '#fff2c4', glow: 1.1 },
    ],
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', color: '#b9b2a8',
    radiusEarths: 0.383, au: 0.387, periodDays: 87.97, L0: 252.25, dayHours: 4222.6, tilt: 0.03,
    texture: tex('mercury'), normal: tex('mercury_n'),
    tagline: 'The smallest planet, and the closest to the Sun.',
    facts: [
      { icon: '🏃', text: 'Mercury is the fastest planet. It zips around the Sun in just 88 days.' },
      { icon: '🌡️', text: 'Daytime is hot enough to melt metal. At night it is freezing cold.' },
      { icon: '🌑', text: 'It is covered in craters, just like our Moon.' },
    ],
    inside: [
      { name: 'Crust', kid: 'A thin rocky skin.', r0: 0.96, r1: 1, color: '#9b9187' },
      { name: 'Mantle', kid: 'A layer of rock.', r0: 0.83, r1: 0.96, color: '#7d5a45' },
      { name: 'Metal core', kid: 'A huge ball of iron. It takes up most of the planet!', r0: 0, r1: 0.83, color: '#d9a066', glow: 0.25 },
    ],
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', color: '#e8c58a',
    radiusEarths: 0.949, au: 0.723, periodDays: 224.7, L0: 181.98, dayHours: -5832.5, tilt: 177.4,
    texture: sdOnly('venus'), atmosphere: '#f3d79a',
    tagline: 'The hottest planet, wrapped in thick yellow clouds.',
    facts: [
      { icon: '🔥', text: 'Venus is the hottest planet, even hotter than Mercury.' },
      { icon: '☁️', text: 'Its thick clouds trap heat like a blanket.' },
      { icon: '🔄', text: 'Venus spins backwards. The Sun rises in the west there!' },
    ],
    inside: [
      { name: 'Crust', kid: 'Rocky ground covered in old volcanoes.', r0: 0.96, r1: 1, color: '#b07a45' },
      { name: 'Mantle', kid: 'Hot, slowly moving rock.', r0: 0.53, r1: 0.96, color: '#c4532c', glow: 0.15 },
      { name: 'Metal core', kid: 'A ball of iron and nickel.', r0: 0, r1: 0.53, color: '#f0b45e', glow: 0.35 },
    ],
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', color: '#5aa0ff',
    radiusEarths: 1, au: 1, periodDays: 365.256, L0: 100.46, dayHours: 23.93, tilt: 23.44, faceU: 0.985, // New Zealand faces you on arrival
   
    texture: tex('earth'), night: tex('earth_night'), clouds: tex('earth_clouds'), normal: tex('earth_n'), spec: sdOnly('earth_spec'), atmosphere: '#6fb3ff',
    tagline: 'Our home! The only planet we know with life.',
    facts: [
      { icon: '🌊', text: 'Most of Earth is covered in water.' },
      { icon: '🐳', text: 'It is the only place we know of with plants, animals and people.' },
      { icon: '🎂', text: 'One trip around the Sun takes one year. That is one birthday!' },
    ],
    actions: [{ id: 'sky', icon: '🌌', label: 'Tonight’s sky from home' }],
    inside: [
      { name: 'Crust', kid: 'The thin rocky skin we live on. Like the shell of an egg.', r0: 0.965, r1: 1, color: '#7c6a55' },
      { name: 'Mantle', kid: 'Very hot rock that moves slowly, like thick toothpaste.', r0: 0.546, r1: 0.965, color: '#d2582a', glow: 0.15 },
      { name: 'Outer core', kid: 'Runny, melted metal. As hot as the surface of the Sun!', r0: 0.19, r1: 0.546, color: '#ff9d2e', glow: 0.45 },
      { name: 'Inner core', kid: 'A solid ball of metal right in the middle.', r0: 0, r1: 0.19, color: '#fff0b8', glow: 0.9 },
    ],
    moons: ['moon'],
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', color: '#e0683c',
    radiusEarths: 0.532, au: 1.524, periodDays: 686.98, L0: 355.45, dayHours: 24.62, tilt: 25.19,
    texture: tex('mars'), normal: tex('mars_n'), normalScale: 2.2, atmosphere: '#e9a77d',
    tagline: 'The red planet. Its dust is rusty, like an old bike.',
    facts: [
      { icon: '🏔️', text: 'Mars has the tallest volcano in the solar system. It is called Olympus Mons.' },
      { icon: '🤖', text: 'Robot rovers are driving on Mars right now!' },
      { icon: '🌅', text: 'Sunsets on Mars are blue.' },
    ],
    inside: [
      { name: 'Crust', kid: 'Red, dusty rock on top.', r0: 0.95, r1: 1, color: '#a8492a' },
      { name: 'Mantle', kid: 'Thick rocky layer.', r0: 0.54, r1: 0.95, color: '#8f3b22', glow: 0.1 },
      { name: 'Core', kid: 'Melted metal in the middle.', r0: 0, r1: 0.54, color: '#f0a050', glow: 0.4 },
    ],
    moons: ['phobos', 'deimos'],
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', color: '#d9b38c',
    radiusEarths: 11.21, au: 5.203, periodDays: 4332.59, L0: 34.4, dayHours: 9.93, tilt: 3.13, faceU: 0.37, // Great Red Spot
   
    texture: tex('jupiter'), atmosphere: '#e8cfa8',
    tagline: 'The biggest planet. A giant ball of gas.',
    facts: [
      { icon: '🌍', text: 'More than 1,300 Earths could fit inside Jupiter.' },
      { icon: '🌀', text: 'The Great Red Spot is a storm bigger than Earth.' },
      { icon: '🌙', text: 'Jupiter has more than 90 moons!' },
    ],
    inside: [
      { name: 'Clouds', kid: 'Stripes of colourful clouds and storms.', r0: 0.97, r1: 1, color: '#e3c49c' },
      { name: 'Liquid gas', kid: 'Gas squeezed so hard it turns into liquid.', r0: 0.78, r1: 0.97, color: '#c49a6c' },
      { name: 'Metal liquid', kid: 'Squeezed even more, it acts like runny metal.', r0: 0.2, r1: 0.78, color: '#8b8fb0', glow: 0.15 },
      { name: 'Core', kid: 'A fuzzy middle of rock and ice.', r0: 0, r1: 0.2, color: '#f2c27a', glow: 0.5 },
    ],
    moons: ['io', 'europa', 'ganymede', 'callisto'],
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', color: '#e8d3a2',
    radiusEarths: 9.45, au: 9.537, periodDays: 10759.22, L0: 49.94, dayHours: 10.66, tilt: 26.73,
    texture: tex('saturn'), rings: true, atmosphere: '#efe0bb',
    tagline: 'The planet with the beautiful rings.',
    facts: [
      { icon: '💍', text: 'Its rings are made of billions of pieces of ice and rock.' },
      { icon: '🛁', text: 'Saturn is so light it could float in a giant bath!' },
      { icon: '🌙', text: 'Saturn has more moons than any other planet.' },
    ],
    inside: [
      { name: 'Clouds', kid: 'Soft yellow clouds.', r0: 0.97, r1: 1, color: '#ecd8a8' },
      { name: 'Liquid gas', kid: 'Gas squeezed into liquid.', r0: 0.6, r1: 0.97, color: '#cdb27d' },
      { name: 'Metal liquid', kid: 'Runny, metal-like layer.', r0: 0.22, r1: 0.6, color: '#8e93ad', glow: 0.15 },
      { name: 'Core', kid: 'Rock and ice in the middle.', r0: 0, r1: 0.22, color: '#f0c27a', glow: 0.5 },
    ],
    moons: ['titan', 'enceladus'],
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', color: '#9fe0e8',
    radiusEarths: 4.01, au: 19.19, periodDays: 30688.5, L0: 313.23, dayHours: -17.24, tilt: 97.77,
    texture: tex('uranus'), atmosphere: '#a8f0f5',
    tagline: 'The ice giant that rolls around on its side.',
    facts: [
      { icon: '🎳', text: 'Uranus is tipped over. It rolls around the Sun like a ball.' },
      { icon: '🥶', text: 'It is one of the coldest places in the solar system.' },
      { icon: '🔭', text: 'It was the first planet found with a telescope.' },
    ],
    inside: [
      { name: 'Air', kid: 'Cold gas. A gas called methane makes it blue.', r0: 0.8, r1: 1, color: '#9ad9e0' },
      { name: 'Icy slush', kid: 'A thick, slushy mix of water and other ices.', r0: 0.25, r1: 0.8, color: '#4f8fb5', glow: 0.1 },
      { name: 'Core', kid: 'Rock in the middle.', r0: 0, r1: 0.25, color: '#b38f6a', glow: 0.3 },
    ],
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', color: '#4f7cff',
    radiusEarths: 3.88, au: 30.07, periodDays: 60182, L0: 304.88, dayHours: 16.11, tilt: 28.32,
    texture: sdOnly('neptune'), atmosphere: '#6e95ff',
    tagline: 'The windiest planet, far, far away.',
    facts: [
      { icon: '💨', text: 'Neptune has the fastest winds. Faster than a jet plane!' },
      { icon: '🎂', text: 'One year on Neptune is 165 Earth years long.' },
      { icon: '🔵', text: 'It is deep blue, like the ocean.' },
    ],
    inside: [
      { name: 'Air', kid: 'Freezing, windy gas.', r0: 0.8, r1: 1, color: '#5b82e6' },
      { name: 'Icy slush', kid: 'Slushy water and ices.', r0: 0.25, r1: 0.8, color: '#2f5aa8', glow: 0.1 },
      { name: 'Core', kid: 'Rock in the middle.', r0: 0, r1: 0.25, color: '#b38f6a', glow: 0.3 },
    ],
    moons: ['triton'],
  },
  {
    id: 'pluto', name: 'Pluto', kind: 'dwarf', color: '#d8c2a8',
    radiusEarths: 0.186, au: 39.48, periodDays: 90560, L0: 238.9, dayHours: -153.3, tilt: 122.5, faceU: 0.5, // the heart
   
    texture: tex('pluto'), normal: tex('pluto_n'), normalScale: 1.4, minKidRadius: 0.55,
    tagline: 'A small icy world with a big heart.',
    facts: [
      { icon: '💗', text: 'Pluto has a giant heart shape made of ice.' },
      { icon: '🧊', text: 'It is so cold that even air freezes there.' },
      { icon: '🚀', text: 'A spacecraft called New Horizons flew past it in 2015.' },
    ],
    inside: [
      { name: 'Ice shell', kid: 'Frozen ice on the outside.', r0: 0.9, r1: 1, color: '#e7dccb' },
      { name: 'Hidden ocean?', kid: 'Scientists think there may be a slushy ocean under the ice.', r0: 0.72, r1: 0.9, color: '#5a8ec2' },
      { name: 'Rocky core', kid: 'A big ball of rock.', r0: 0, r1: 0.72, color: '#8b6d55', glow: 0.1 },
    ],
    moons: ['charon'],
  },

  // ---- Moons (orbit = multiple of the parent's radius so they work at any size)
  {
    id: 'moon', name: 'The Moon', kind: 'moon', parent: 'earth', color: '#cfcfcf',
    radiusEarths: 0.273, orbitR: 3.6, periodDays: 27.3, texture: tex('moon'), normal: tex('moon_n'), normalScale: 1.2, minKidRadius: 0.32,
    tagline: 'Earth\'s best friend in space.',
    facts: [
      { icon: '👣', text: '12 astronauts have walked on the Moon.' },
      { icon: '🌗', text: 'The Moon does not make its own light. It shines with sunlight.' },
      { icon: '🌊', text: 'It pulls on our oceans and makes the tides.' },
    ],
    inside: [
      { name: 'Crust', kid: 'Grey dusty rock.', r0: 0.97, r1: 1, color: '#a9a9a9' },
      { name: 'Mantle', kid: 'Thick rock.', r0: 0.22, r1: 0.97, color: '#77695e' },
      { name: 'Core', kid: 'A small metal ball.', r0: 0, r1: 0.22, color: '#e6a865', glow: 0.4 },
    ],
  },
  { id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', color: '#9c8d7d', radiusEarths: 0.0018, model: 'models/phobos.glb', orbitR: 2.4, periodDays: 0.32, minKidRadius: 0.16,
    tagline: 'A lumpy little moon of Mars.',
    facts: [{ icon: '🥔', text: 'Phobos is shaped like a potato.' }, { icon: '⚡', text: 'It goes around Mars three times every day.' }, { icon: '📉', text: 'It is slowly getting closer to Mars.' }] },
  { id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', color: '#a89a8a', radiusEarths: 0.001, model: 'models/deimos.glb', orbitR: 3.6, periodDays: 1.26, minKidRadius: 0.12,
    tagline: 'Mars\' tiny outer moon.',
    facts: [{ icon: '🐭', text: 'Deimos is one of the smallest moons we know.' }, { icon: '🏃', text: 'You could run around it in a day or two.' }, { icon: '🥔', text: 'Like Phobos, it is a lumpy rock.' }] },
  { id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', color: '#e6d36b', radiusEarths: 0.286, orbitR: 1.6, periodDays: 1.77, texture: tex('io'), normal: tex('io_n'), normalScale: 1.5, minKidRadius: 0.32,
    tagline: 'The moon covered in volcanoes.',
    facts: [{ icon: '🌋', text: 'Io has more volcanoes than anywhere else we know.' }, { icon: '🧀', text: 'It is yellow and spotty, a bit like pizza.' }, { icon: '💥', text: 'Some volcanoes shoot lava higher than mountains.' }] },
  { id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', color: '#e6dccb', radiusEarths: 0.245, orbitR: 2.0, periodDays: 3.55, texture: tex('europa'), normal: tex('europa_n'), normalScale: 1.5, minKidRadius: 0.3,
    tagline: 'An icy moon with a secret ocean.',
    facts: [{ icon: '🌊', text: 'Under its ice there is a giant salty ocean.' }, { icon: '🔍', text: 'Scientists wonder if tiny living things could live there.' }, { icon: '🧊', text: 'Its icy shell is covered in long cracks.' }],
    inside: [
      { name: 'Ice shell', kid: 'Thick ice on top.', r0: 0.985, r1: 1, color: '#eaf3ff' },
      { name: 'Ocean', kid: 'A deep, dark, salty ocean. More water than all of Earth\'s oceans!', r0: 0.9, r1: 0.985, color: '#2f77c9', glow: 0.1 },
      { name: 'Rock', kid: 'A rocky layer.', r0: 0.4, r1: 0.9, color: '#8a6e57' },
      { name: 'Metal core', kid: 'Iron in the middle.', r0: 0, r1: 0.4, color: '#e2a35c', glow: 0.35 },
    ] },
  { id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', color: '#b7aa98', radiusEarths: 0.413, orbitR: 2.6, periodDays: 7.15, texture: tex('ganymede'), normal: tex('ganymede_n'), normalScale: 1.5, minKidRadius: 0.38,
    tagline: 'The biggest moon in the solar system.',
    facts: [{ icon: '🏆', text: 'Ganymede is bigger than the planet Mercury!' }, { icon: '🧲', text: 'It is the only moon with its own magnet field.' }, { icon: '🌊', text: 'It probably has an ocean under its ice.' }] },
  { id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', color: '#7f7466', radiusEarths: 0.378, orbitR: 3.3, periodDays: 16.69, texture: tex('callisto'), normal: tex('callisto_n'), normalScale: 1.6, minKidRadius: 0.36,
    tagline: 'The moon with the most craters.',
    facts: [{ icon: '🕳️', text: 'Callisto is covered in more craters than any other moon.' }, { icon: '👴', text: 'Its surface is very, very old.' }, { icon: '🧊', text: 'It is made of ice and rock mixed together.' }] },
  { id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', color: '#e0a54a', radiusEarths: 0.404, orbitR: 2.9, periodDays: 15.95, texture: tex('titan'), atmosphere: '#e8a24a', minKidRadius: 0.38,
    tagline: 'A moon with thick orange air and lakes.',
    facts: [{ icon: '🌫️', text: 'Titan has thick orange air, like a smoggy day.' }, { icon: '🏞️', text: 'It has rivers and lakes, but they are not water. They are made of fuel-like liquid.' }, { icon: '🚁', text: 'A helicopter called Dragonfly will fly there one day.' }] },
  { id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', color: '#f2f6ff', radiusEarths: 0.0395, orbitR: 2.1, periodDays: 1.37, texture: tex('enceladus'), minKidRadius: 0.18,
    tagline: 'A snowball moon with icy fountains.',
    facts: [{ icon: '⛲', text: 'It shoots fountains of icy water into space.' }, { icon: '❄️', text: 'It is the shiniest, whitest thing in the solar system.' }, { icon: '🌊', text: 'There is an ocean under its ice.' }] },
  { id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', color: '#d9c7b8', radiusEarths: 0.212, orbitR: 2.4, periodDays: -5.88, texture: tex('triton'), minKidRadius: 0.28,
    tagline: 'Neptune\'s moon that goes the wrong way.',
    facts: [{ icon: '↩️', text: 'Triton goes around Neptune backwards!' }, { icon: '🧊', text: 'It is one of the coldest places we know.' }, { icon: '💨', text: 'It has geysers that puff out dark dust.' }] },
  { id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', color: '#a9a29b', radiusEarths: 0.095, orbitR: 2.6, periodDays: 6.39, texture: tex('charon'), normal: tex('charon_n'), normalScale: 1.5, minKidRadius: 0.3,
    tagline: 'Pluto\'s big buddy moon.',
    facts: [{ icon: '👯', text: 'Charon is half as big as Pluto. They dance around each other.' }, { icon: '🔴', text: 'It has a reddish cap on top.' }, { icon: '🔒', text: 'Pluto and Charon always show each other the same face.' }] },

  // ---- Asteroids (real NASA shape models, shown much bigger than real life)
  { id: 'ceres', name: 'Ceres', kind: 'asteroid', color: '#9a958e', radiusEarths: 0.074, au: 2.77, periodDays: 1681.6, L0: 95.0, dayHours: 9.07, texture: tex('ceres'), normal: tex('ceres_n'), normalScale: 1.6, minKidRadius: 0.5,
    tagline: 'The biggest thing in the asteroid belt.',
    facts: [{ icon: '👑', text: 'Ceres is so big it is called a dwarf planet.' }, { icon: '✨', text: 'It has shiny bright spots made of salt.' }, { icon: '🛰️', text: 'The Dawn spacecraft visited it.' }] },
  { id: 'vesta', name: 'Vesta', kind: 'asteroid', color: '#a49c90', radiusEarths: 0.04, au: 2.36, periodDays: 1325.5, L0: 20.0, dayHours: 5.34, model: 'models/vesta.glb', minKidRadius: 0.45,
    tagline: 'A giant asteroid with a huge crater.',
    facts: [{ icon: '💥', text: 'Vesta has a crater almost as wide as the whole asteroid.' }, { icon: '☄️', text: 'Bits of Vesta have fallen to Earth as meteorites.' }, { icon: '🛰️', text: 'This shape is real. It was measured by the Dawn spacecraft.' }] },
  { id: 'eros', name: 'Eros', kind: 'asteroid', color: '#a5896a', radiusEarths: 0.0013, au: 1.46, periodDays: 643, L0: 200.0, dayHours: 5.27, model: 'models/eros.glb', minKidRadius: 0.35,
    tagline: 'A peanut-shaped asteroid near Mars.',
    facts: [{ icon: '🥜', text: 'Eros is shaped like a giant peanut.' }, { icon: '🛬', text: 'A spacecraft called NEAR landed on it in 2001.' }, { icon: '🛰️', text: 'This is its real shape.' }] },
  { id: 'bennu', name: 'Bennu', kind: 'asteroid', color: '#5a5651', radiusEarths: 0.00004, au: 1.126, periodDays: 436.6, L0: 300.0, dayHours: 4.3, model: 'models/bennu.glb', minKidRadius: 0.3,
    tagline: 'A spinning-top asteroid full of boulders.',
    facts: [{ icon: '🪀', text: 'Bennu is shaped like a spinning top.' }, { icon: '📦', text: 'The OSIRIS-REx spacecraft scooped up some of its dust and brought it to Earth!' }, { icon: '🪨', text: 'It is a big pile of rocks stuck together.' }] },
  { id: 'itokawa', name: 'Itokawa', kind: 'asteroid', color: '#8f8579', radiusEarths: 0.00003, au: 1.324, periodDays: 556.4, L0: 150.0, dayHours: 12.1, model: 'models/itokawa.glb', minKidRadius: 0.3,
    tagline: 'A tiny asteroid shaped like a sea otter.',
    facts: [{ icon: '🦦', text: 'Itokawa looks a bit like a sea otter floating on its back.' }, { icon: '🇯🇵', text: 'The Japanese spacecraft Hayabusa brought back its dust.' }, { icon: '🛰️', text: 'This is its real shape.' }] },

  // ---- Spacecraft
  { id: 'iss', name: 'Space Station', kind: 'craft', parent: 'earth', color: '#f2f2f2', orbitR: 1.22, periodDays: 0.0644,
    tagline: 'A home in space where astronauts live and work.',
    facts: [
      { icon: '🧑‍🚀', text: 'Astronauts have lived on it every day since the year 2000.' },
      { icon: '🌅', text: 'It goes around Earth 16 times a day. That is 16 sunrises!' },
      { icon: '⚽', text: 'It is as big as a football field.' },
    ] },
  { id: 'hubble', name: 'Hubble Telescope', kind: 'craft', parent: 'earth', color: '#d7d7d7', orbitR: 1.3, periodDays: 0.066,
    tagline: 'A giant camera that looks deep into space.',
    facts: [
      { icon: '📸', text: 'Hubble takes amazing pictures of faraway stars and galaxies.' },
      { icon: '🚌', text: 'It is about as big as a school bus.' },
      { icon: '🧑‍🔧', text: 'Astronauts flew up to fix it five times.' },
    ] },
];

export const BODY = Object.fromEntries(BODIES.map((b) => [b.id, b]));

export const DOCK = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'belt', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'iss'];

export const BELT = {
  id: 'belt', name: 'Asteroid Belt', kind: 'region', color: '#a3998b',
  tagline: 'A big ring of space rocks between Mars and Jupiter.',
  facts: [
    { icon: '🪨', text: 'There are millions of rocks here, big and small.' },
    { icon: '🚀', text: 'They are very far apart. Spacecraft fly through easily.' },
    { icon: '👆', text: 'Tap Ceres, Vesta, Eros, Bennu or Itokawa to visit a real asteroid.' },
  ],
  chips: ['ceres', 'vesta', 'eros', 'bennu', 'itokawa'],
};

// ISS interior hotspots
export const ISS_SPOTS = {
  sleep: { name: 'Sleeping pods', icon: '😴', text: 'Astronauts sleep in tiny rooms the size of a phone box. They zip into a sleeping bag tied to the wall so they don\'t float away!' },
  water: { name: 'Floating water', icon: '💧', text: 'With no gravity, water floats in wobbly balls. Astronauts can catch it with a straw!' },
  science: { name: 'Science racks', icon: '🧪', text: 'These cupboards are full of experiments. Astronauts grow plants, test medicines and study how bodies change in space.' },
  laptop: { name: 'Computers', icon: '💻', text: 'There are lots of laptops. Astronauts use them to run the station and to video call their families.' },
  treadmill: { name: 'Treadmill', icon: '🏃', text: 'Astronauts exercise for two hours every day. They wear a harness so they don\'t float off the treadmill!' },
  toilet: { name: 'Space toilet', icon: '🚽', text: 'The toilet uses air to suck everything away, like a vacuum cleaner. Wee is cleaned and turned back into drinking water!' },
  food: { name: 'Kitchen', icon: '🍫', text: 'Space food comes in packets. Tortillas are used instead of bread, because bread makes crumbs that float everywhere.' },
  cupola: { name: 'Cupola window', icon: '🪟', text: 'This is the best window in space! Astronauts look down at Earth from here. Look below you!' },
  hatch: { name: 'Hatch', icon: '🚪', text: 'Hatches are doors between modules. In an emergency they can be closed to keep the air in.' },
  kibo: { name: 'Kibo lab', icon: '🇯🇵', text: 'Kibo is Japan\'s science lab. It is the biggest room on the station.' },
};
