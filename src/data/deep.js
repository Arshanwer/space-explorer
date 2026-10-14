// Places out beyond the solar system. Written for 6–8 year olds; numbers rounded and checked
// against NASA / ESA facts. Distances in light-years ("ly").
//
// range: how far away the camera can be (ly) for the name to show. pri: smaller = more important.

export const LIGHT_YEAR_FACT = 'A light-year is how far light travels in one year. That is about 9 and a half trillion kilometres!';

export const RUNGS = [
  { id: 'planets', icon: '🪐', name: 'Planets', hint: 'Our Sun and its planets' },
  { id: 'nearby', icon: '⭐', name: 'Nearest stars', z: Math.log10(24), target: 'sun', elev: 24,
    toast: 'These are the stars closest to the Sun. Their light takes years to get to us!' },
  { id: 'neighbours', icon: '✨', name: 'Star neighbours', z: Math.log10(1600), target: 'sun', elev: 30,
    toast: 'The stars you can see at night are all around us here, near and far.' },
  { id: 'milkyway', icon: '🌌', name: 'Milky Way', z: Math.log10(150000), target: 'galcentre', elev: 52,
    toast: 'This is our galaxy, the Milky Way! The Sun is one of billions of stars in it.' },
  { id: 'localgroup', icon: '🌀', name: 'Galaxy neighbours', z: Math.log10(3.6e6), target: 'localgroup', elev: 30,
    toast: 'These are our neighbour galaxies. Light from Andromeda takes 2.5 million years to get to us!' },
  { id: 'universe', icon: '🔭', name: 'Galaxies everywhere', z: Math.log10(4.2e8), target: 'galcentre', elev: 28,
    toast: 'Every dot is a whole galaxy, full of stars. There are billions more, too far and faint to show here!' },
];

export const DEEP_DOCK = ['starlife', 'sun', 'proxima', 'alphacen', 'barnard', 'wolf359', 'sirius', 'vega', 'arcturus', 'matariki',
  'southerncross', 'betelgeuse', 'rigel', 'polaris', 'canopus', 'antares', 'deneb',
  'helix', 'orion', 'horsehead', 'ring', 'southernring', 'eagle', 'crab', 'carina',
  'galcentre', 'nsc', 'sgra', 'lmc', 'tarantula', 'smc', 'andromeda', 'triangulum', 'cena', 'pinwheel', 'sombrero', 'whirlpool', 'm87', 'virgo', 'deepfield'];

// a real photo for the card (and a little round one for the dock)
const pic = (id, alt, caption) => ({ src: `tex/astro/card/${id}.jpg`, alt, caption });

const star = (o) => ({ kind: 'star', ...o });
const STORY = 'starlife';

export const DEEP = {
  starlife: { kind: 'story', name: 'The life of a star', short: 'Life of a star', emoji: '🌟', range: [0, 0], facts: [], tagline: '' },
  sun: star({
    name: 'The Sun', short: 'Sun', color: '#ffd27a', range: [0, 9000], pri: 0,
    tagline: 'Our star, seen from far away.',
    chips: [STORY], chipsTitle: 'Find out more',
    facts: [
      { icon: '🌟', text: 'From out here the Sun looks like any other star.' },
      { icon: '🏠', text: 'All eight planets, and you, are inside that little dot of light.' },
      { icon: '🛰️', text: 'Voyager 1, our farthest spacecraft, is now almost one light-day from the Sun.' },
    ],
  }),
  proxima: star({
    name: 'Proxima Centauri', short: 'Proxima', range: [0, 60], pri: 2,
    tagline: 'The closest star to the Sun.',
    facts: [
      { icon: '📏', text: 'It is about 4.2 light-years away. No star is closer to us!' },
      { icon: '🔴', text: 'It is a small red dwarf star, much cooler and dimmer than the Sun.' },
      { icon: '🪐', text: 'A rocky planet called Proxima b goes around it.' },
      { icon: '🔭', text: 'It is too faint to see without a telescope.' },
    ],
  }),
  alphacen: star({
    name: 'Alpha Centauri', short: 'Alpha Centauri', range: [0, 260], pri: 1,
    tagline: 'Two Sun-like stars dancing around each other.',
    chips: ['proxima'],
    facts: [
      { icon: '👯', text: 'It is really two stars, going around each other once every 80 years.' },
      { icon: '🇳🇿', text: 'You can see it from New Zealand every night. It is one of the two Pointers next to the Southern Cross.' },
      { icon: '🚀', text: 'Our fastest spacecraft would need thousands of years to get there.' },
    ],
  }),
  barnard: star({
    name: "Barnard's Star", short: "Barnard's Star", range: [0, 90], pri: 2,
    tagline: 'The star that moves fastest across our sky.',
    facts: [
      { icon: '🏃', text: 'It slides across the sky faster than any other star.' },
      { icon: '🔴', text: 'It is an old red dwarf star, about 6 light-years away.' },
      { icon: '🪐', text: 'Scientists recently found four small rocky planets going around it.' },
    ],
  }),
  wolf359: star({
    name: 'Wolf 359', short: 'Wolf 359', range: [0, 70], pri: 3,
    tagline: 'A tiny, dim star 8 light-years away.',
    facts: [
      { icon: '🔴', text: 'It is one of the smallest stars we know, only about one-seventh as wide as the Sun.' },
      { icon: '🔭', text: 'It is so dim you need a telescope to see it, even though it is close.' },
      { icon: '💥', text: 'Sometimes it flares up with huge bursts of light.' },
    ],
  }),
  sirius: star({
    name: 'Sirius', short: 'Sirius', range: [0, 400], pri: 1,
    tagline: 'The brightest star in our night sky.',
    facts: [
      { icon: '✨', text: 'Sirius is the brightest star you can see at night.' },
      { icon: '💪', text: 'It is about twice as heavy as the Sun and shines 25 times brighter.' },
      { icon: '👻', text: 'It has a tiny partner called Sirius B. It is a dead star about the size of Earth.' },
      { icon: '📏', text: 'It is about 8.6 light-years away.' },
    ],
  }),
  epseri: star({
    name: 'Epsilon Eridani', short: 'Epsilon Eridani', range: [0, 70], pri: 4,
    tagline: 'A young star with dusty rings.',
    facts: [
      { icon: '👶', text: 'It is a young star, less than a billion years old. The Sun is about 4.6 billion.' },
      { icon: '💍', text: 'It has rings of dust and ice, a bit like our asteroid belt.' },
      { icon: '🪐', text: 'A giant planet goes around it.' },
    ],
  }),
  procyon: star({
    name: 'Procyon', short: 'Procyon', range: [0, 160], pri: 3,
    tagline: 'A bright star with a tiny dead partner.',
    facts: [
      { icon: '✨', text: 'It is one of the brightest stars in our sky.' },
      { icon: '👻', text: 'Like Sirius, it has a tiny white dwarf star going around it.' },
      { icon: '📏', text: 'It is about 11.5 light-years away.' },
    ],
  }),
  tauceti: star({
    name: 'Tau Ceti', short: 'Tau Ceti', range: [0, 70], pri: 4,
    tagline: 'A star a lot like our Sun.',
    facts: [
      { icon: '☀️', text: 'It is a bit smaller and cooler than the Sun, but quite similar.' },
      { icon: '🪐', text: 'Scientists think several planets may go around it.' },
      { icon: '📏', text: 'It is about 12 light-years away.' },
    ],
  }),
  altair: star({
    name: 'Altair', short: 'Altair', range: [0, 220], pri: 3,
    tagline: 'A star that spins super fast.',
    facts: [
      { icon: '🌀', text: 'It spins all the way round in less than 8 hours. The Sun takes almost a month!' },
      { icon: '🥚', text: 'All that spinning squashes it, so it is fatter in the middle.' },
      { icon: '📏', text: 'It is about 17 light-years away.' },
    ],
  }),
  vega: star({
    name: 'Vega', short: 'Vega', range: [0, 300], pri: 2,
    tagline: 'A bright blue-white star.',
    facts: [
      { icon: '🧭', text: 'Thousands of years from now, Vega will be the North Star.' },
      { icon: '🌀', text: 'It spins so fast that it bulges out in the middle.' },
      { icon: '📏', text: 'It is about 25 light-years away.' },
    ],
  }),
  fomalhaut: star({
    name: 'Fomalhaut', short: 'Fomalhaut', range: [0, 260], pri: 4,
    tagline: 'A star with a giant ring of dust.',
    facts: [
      { icon: '👁️', text: 'A huge ring of dust goes around it. In telescope pictures it looks like a giant eye.' },
      { icon: '🇳🇿', text: 'It shines high over New Zealand on spring evenings.' },
      { icon: '📏', text: 'It is about 25 light-years away.' },
    ],
  }),
  arcturus: star({
    name: 'Arcturus', short: 'Arcturus', range: [0, 450], pri: 2,
    tagline: 'A big orange giant star.',
    facts: [
      { icon: '🟠', text: 'It is about 25 times wider than the Sun.' },
      { icon: '✨', text: 'It is the brightest star in the northern half of the sky.' },
      { icon: '📏', text: 'It is about 37 light-years away.' },
    ],
  }),
  capella: star({
    name: 'Capella', short: 'Capella', range: [2, 500], pri: 4,
    tagline: 'Four stars that look like one.',
    facts: [
      { icon: '🔢', text: 'Capella is really four stars: two big yellow ones and two little red ones.' },
      { icon: '🟡', text: 'Its two big stars are giants, each about 10 times wider than the Sun.' },
      { icon: '📏', text: 'It is about 43 light-years away.' },
    ],
  }),
  aldebaran: star({
    name: 'Aldebaran', short: 'Aldebaran', range: [3, 700], pri: 3,
    tagline: 'The red eye of the Bull.',
    facts: [
      { icon: '🐂', text: 'It is the bright orange eye of Taurus, the Bull.' },
      { icon: '🛰️', text: 'The Pioneer 10 spacecraft is heading its way. It will take about 2 million years to get there.' },
      { icon: '📏', text: 'It is about 65 light-years away.' },
    ],
  }),
  achernar: star({
    name: 'Achernar', short: 'Achernar', range: [5, 1500], pri: 4,
    tagline: 'One of the flattest stars we know.',
    facts: [
      { icon: '🌀', text: 'It spins so fast it is squashed, much wider around its middle than top to bottom.' },
      { icon: '🇳🇿', text: 'From New Zealand you can see it all year round.' },
      { icon: '📏', text: 'It is about 140 light-years away.' },
    ],
  }),
  canopus: star({
    name: 'Canopus', short: 'Canopus', range: [10, 3000], pri: 2,
    tagline: 'The second brightest star in our night sky.',
    facts: [
      { icon: '🧭', text: 'Spacecraft use Canopus to find their way, like a lighthouse in space.' },
      { icon: '🇳🇿', text: 'It is easy to see from New Zealand. Māori call it Atutahi.' },
      { icon: '📏', text: 'It is about 310 light-years away.' },
    ],
  }),
  polaris: star({
    name: 'Polaris, the North Star', short: 'Polaris', range: [10, 3000], pri: 2,
    tagline: 'The star above the North Pole.',
    facts: [
      { icon: '🧭', text: 'It sits almost right above Earth’s North Pole, so it hardly moves in the sky.' },
      { icon: '🇳🇿', text: 'You can’t see it from New Zealand. It is always below our horizon.' },
      { icon: '📏', text: 'It is a big yellow star about 430 light-years away.' },
    ],
  }),
  betelgeuse: star({
    name: 'Betelgeuse', short: 'Betelgeuse', range: [10, 4000], pri: 1,
    tagline: 'A giant red star in Orion.',
    chips: [STORY], chipsTitle: 'Find out more',
    facts: [
      { icon: '😮', text: 'If it took the Sun’s place, it would swallow Mercury, Venus, Earth and Mars!' },
      { icon: '💥', text: 'One day it will explode as a supernova. That could happen any time in the next 100,000 years.' },
      { icon: '📏', text: 'It is about 550 light-years away.' },
    ],
  }),
  antares: star({
    name: 'Antares', short: 'Antares', range: [10, 4000], pri: 2,
    tagline: 'The red heart of the Scorpion.',
    facts: [
      { icon: '🔴', text: 'It is a red supergiant, about 700 times wider than the Sun.' },
      { icon: '🔥', text: 'Its name means “rival of Mars”, because it is red like Mars.' },
      { icon: '🇳🇿', text: 'It shines high over New Zealand on winter nights.' },
    ],
  }),
  rigel: star({
    name: 'Rigel', short: 'Rigel', range: [10, 5000], pri: 2,
    tagline: 'A giant blue-white star in Orion.',
    facts: [
      { icon: '💡', text: 'It shines about 100,000 times brighter than the Sun.' },
      { icon: '🏰', text: 'It is about 860 light-years away, so its light left when there were knights and castles.' },
      { icon: '⏳', text: 'Big hot stars like Rigel burn out much faster than the Sun.' },
    ],
  }),
  deneb: star({
    name: 'Deneb', short: 'Deneb', range: [10, 6000], pri: 2,
    tagline: 'One of the brightest stars we know.',
    facts: [
      { icon: '💡', text: 'It shines around 200,000 times brighter than the Sun.' },
      { icon: '🦢', text: 'It is the tail of the Swan constellation.' },
      { icon: '⏳', text: 'It is so far away that its light left it well over a thousand years ago.' },
    ],
  }),
  spica: star({
    name: 'Spica', short: 'Spica', range: [10, 2500], pri: 4,
    tagline: 'Two hot blue stars, very close together.',
    facts: [
      { icon: '👯', text: 'Spica is two stars so close they go around each other in just 4 days.' },
      { icon: '🥚', text: 'They pull on each other so hard they are stretched into egg shapes.' },
      { icon: '📏', text: 'It is about 250 light-years away.' },
    ],
  }),
  acrux: star({
    name: 'Acrux', short: 'Acrux', range: [0.5, 1500], pri: 3,
    tagline: 'The brightest star of the Southern Cross.',
    facts: [
      { icon: '🇳🇿', text: 'It is the star at the bottom of the Southern Cross, the end that points towards the South Pole.' },
      { icon: '💙', text: 'It is really several hot blue stars, so close together they look like one.' },
      { icon: '📏', text: 'It is about 320 light-years away.' },
    ],
  }),
  mimosa: star({
    name: 'Mimosa', short: 'Mimosa', range: [0.5, 1500], pri: 4,
    tagline: 'A big hot blue star in the Southern Cross.',
    facts: [
      { icon: '💙', text: 'It is a blue giant, thousands of times brighter than the Sun.' },
      { icon: '🇳🇿', text: 'It is the second brightest star in the Southern Cross.' },
      { icon: '📏', text: 'It is about 280 light-years away.' },
    ],
  }),
  imai: star({
    name: 'Imai', short: 'Imai', range: [0.5, 900], pri: 4,
    tagline: 'The faintest of the four flag stars.',
    facts: [
      { icon: '🇳🇿', text: 'It is the smallest of the four stars on the New Zealand flag, on the right-hand side of the cross.' },
      { icon: '💙', text: 'It is a hot blue star, much bigger and brighter than the Sun.' },
      { icon: '📏', text: 'It is about 345 light-years away.' },
    ],
  }),
  gacrux: star({
    name: 'Gacrux', short: 'Gacrux', range: [0.5, 900], pri: 4,
    tagline: 'The red giant at the top of the Southern Cross.',
    facts: [
      { icon: '🔴', text: 'It is an old red giant star. Look closely and it looks a little orange-red in the sky.' },
      { icon: '📏', text: 'It is about 90 light-years away, much closer than the other stars in the cross.' },
      { icon: '🇳🇿', text: 'It is the star at the top of the cross.' },
    ],
  }),
  matariki: {
    kind: 'cluster', name: 'Matariki (the Pleiades)', short: 'Matariki', color: '#9cc4ff', range: [5, 5000], pri: 1, emoji: '✨',
    tagline: 'A family of young stars.',
    facts: [
      { icon: '🎉', text: 'When Matariki rises before dawn in winter, it is the Māori New Year. It is a holiday in New Zealand!' },
      { icon: '👶', text: 'It is a cluster of more than a thousand young stars, born together about 100 million years ago.' },
      { icon: '👀', text: 'Most people can see 6 or 7 of its stars with just their eyes.' },
      { icon: '📏', text: 'It is about 440 light-years away.' },
    ],
  },
  southerncross: {
    kind: 'constellation', name: 'The Southern Cross', short: 'Southern Cross', color: '#cfe0ff', range: [0.5, 40], pri: 1, emoji: '🇳🇿',
    stars: ['acrux', 'mimosa', 'gacrux', 'imai'], lines: [['acrux', 'gacrux'], ['mimosa', 'imai']],
    tagline: 'The star pattern on the New Zealand flag.',
    facts: [
      { icon: '🇳🇿', text: 'The four stars on the New Zealand flag are the Southern Cross. Māori call it Māhutonga.' },
      { icon: '📏', text: 'Its stars are not all the same distance away. Gacrux is about 90 light-years from us, but Acrux is about 320.' },
      { icon: '🔄', text: 'You are looking from home. Drag to fly around it: from anywhere else in space, the cross falls apart!' },
    ],
  },
  orion: {
    kind: 'nebula', kindLabel: 'A star nursery', name: 'The Orion Nebula', short: 'Orion Nebula', color: '#ffb3d0', range: [4, 9000], pri: 1, thumb: true,
    tagline: 'A giant cloud where new stars are being born.',
    chips: ['horsehead', 'betelgeuse', 'rigel', STORY],
    picture: pic('orion', 'A huge glowing pink, orange and blue cloud', 'The Orion Nebula, seen by Hubble.'),
    facts: [
      { icon: '👶', text: 'It is a star nursery. Thousands of new stars are being born inside it right now.' },
      { icon: '🇳🇿', text: 'You can see it from New Zealand without a telescope: a fuzzy smudge in the handle of “the Pot” (Orion).' },
      { icon: '✨', text: 'Four bright young stars in its middle make the whole cloud glow.' },
      { icon: '📏', text: 'It is about 1,300 light-years away and 24 light-years across.' },
    ],
  },
  horsehead: {
    kind: 'nebula', kindLabel: 'A dark cloud', name: 'The Horsehead Nebula', short: 'Horsehead', color: '#ffc9a8', range: [2, 4000], pri: 3, thumb: true,
    tagline: 'A cloud of dust shaped like a horse’s head.',
    chips: ['orion'],
    picture: pic('horsehead', 'A tall cloud shaped like a horse’s head', 'Hubble took this picture with infrared light, which can see into the dust.'),
    facts: [
      { icon: '🐴', text: 'It is a thick cloud of dust shaped like a horse’s head. In normal light it looks like a dark shadow.' },
      { icon: '⏳', text: 'Light from nearby stars is slowly wearing it away. In about 5 million years it will be gone.' },
      { icon: '📏', text: 'It is about 1,400 light-years away, near Orion’s belt.' },
    ],
  },
  eagle: {
    kind: 'nebula', kindLabel: 'A star nursery', name: 'The Pillars of Creation', short: 'Pillars of Creation', color: '#b8f0d8', range: [3, 20000], pri: 2, thumb: true,
    tagline: 'Giant towers of gas where stars are born.',
    picture: pic('eagle', 'Three tall brown towers of gas against a green glow', 'Hubble’s famous picture from 1995.'),
    facts: [
      { icon: '🏛️', text: 'These towers are made of cold gas and dust. The tallest one is about 4 light-years long.' },
      { icon: '👶', text: 'New stars are forming inside the pillars.' },
      { icon: '🦅', text: 'They are inside the Eagle Nebula, about 6,500 light-years away.' },
    ],
  },
  carina: {
    kind: 'nebula', kindLabel: 'A star nursery', name: 'The Carina Nebula', short: 'Carina Nebula', color: '#ffcf9e', range: [6, 25000], pri: 2, thumb: true,
    tagline: 'A huge star nursery with “Cosmic Cliffs”.',
    chips: ['mystic'],
    picture: pic('carina', 'Orange mountains of gas under a blue sky full of stars', 'The “Cosmic Cliffs”, one of the first pictures from the James Webb Space Telescope.'),
    facts: [
      { icon: '🏔️', text: 'These mountains of gas are called the Cosmic Cliffs. The tallest peaks are about 7 light-years high.' },
      { icon: '🔭', text: 'This was one of the very first pictures from the James Webb Space Telescope, in 2022.' },
      { icon: '🇳🇿', text: 'The Carina Nebula is in the southern sky. You can see it from New Zealand without a telescope.' },
      { icon: '📏', text: 'It is about 7,600 light-years away.' },
    ],
  },
  mystic: {
    kind: 'nebula', kindLabel: 'A star nursery', name: 'Mystic Mountain', short: 'Mystic Mountain', color: '#ffcf9e', range: [2, 4000], pri: 3, thumb: true,
    tagline: 'A tower of gas and dust in the Carina Nebula.',
    chips: ['carina'],
    picture: pic('mystic', 'A tall tower of gas with jets shooting from its top', 'Hubble took this picture for its 20th birthday, in 2010.'),
    facts: [
      { icon: '⛰️', text: 'This tower is 3 light-years tall. Light takes 3 years to go from the bottom to the top!' },
      { icon: '🌬️', text: 'Hot young stars nearby are blowing it away, bit by bit.' },
      { icon: '👶', text: 'Baby stars hidden inside shoot out the jets of gas you can see at the top.' },
    ],
  },
  crab: {
    kind: 'nebula', kindLabel: 'An exploded star', name: 'The Crab Nebula', short: 'Crab Nebula', color: '#a8f0e8', range: [4, 20000], pri: 2, thumb: true,
    tagline: 'What is left of a star that exploded.',
    chips: ['crabpulsar', STORY],
    picture: pic('crab', 'A tangled ball of glowing orange and blue threads', 'The Crab Nebula, seen by Hubble.'),
    facts: [
      { icon: '💥', text: 'A giant star exploded here. People saw the explosion in the year 1054. For weeks it was bright enough to see in the daytime!' },
      { icon: '🌀', text: 'In the middle is a tiny spinning star called a pulsar. It spins round 30 times every second!' },
      { icon: '📏', text: 'It is about 6,500 light-years away, and it is still getting bigger.' },
    ],
  },
  crabpulsar: {
    kind: 'star', kindLabel: 'A neutron star', name: 'The Crab Pulsar', short: 'Crab Pulsar', color: '#cfe8ff', range: [0.005, 6], pri: 1, emoji: '💫',
    tagline: 'A tiny, super-heavy star spinning like crazy.',
    chips: ['crab'],
    picture: pic('crabcore', 'Glowing blue and orange wisps around two stars', 'The middle of the Crab Nebula. The pulsar is the left one of the two stars near the middle.'),
    facts: [
      { icon: '🏙️', text: 'It is only about as wide as a city, but heavier than the Sun.' },
      { icon: '🌀', text: 'It spins round 30 times every second, sweeping beams of light across space like a lighthouse.' },
      { icon: '🥄', text: 'It is so squashed that a teaspoon of it would weigh as much as a mountain.' },
    ],
  },
  ring: {
    kind: 'nebula', kindLabel: 'A dying star’s cloud', name: 'The Ring Nebula', short: 'Ring Nebula', color: '#ffd38a', range: [1, 8000], pri: 3, thumb: true,
    tagline: 'A glowing ring puffed off by a dying star.',
    chips: ['helix', 'southernring', STORY],
    picture: pic('ring', 'A glowing ring, blue in the middle and orange outside', 'The Ring Nebula, seen by Hubble.'),
    facts: [
      { icon: '💍', text: 'A star like our Sun puffed off its outside layers here. They glow like a giant ring.' },
      { icon: '⚪', text: 'The tiny dot in the middle is what is left of the star: a white dwarf.' },
      { icon: '☀️', text: 'Our Sun will do this too, in about 8 billion years.' },
      { icon: '📏', text: 'It is about 2,500 light-years away.' },
    ],
  },
  helix: {
    kind: 'nebula', kindLabel: 'A dying star’s cloud', name: 'The Helix Nebula', short: 'Helix Nebula', color: '#9fd8ff', range: [2, 4000], pri: 3, thumb: true,
    tagline: 'A giant glowing eye in space.',
    chips: ['ring', 'southernring'],
    picture: pic('helix', 'A glowing ring like a giant eye, blue in the middle and red outside', 'The Helix Nebula, seen by Hubble and a telescope on the ground.'),
    facts: [
      { icon: '👁️', text: 'Some people call it the Eye of God, because it looks like a giant eye.' },
      { icon: '☀️', text: 'It is the puffed-off layers of a dying star, like the Ring Nebula, but closer to us.' },
      { icon: '📏', text: 'It is about 650 light-years away, one of the closest clouds like this to Earth.' },
    ],
  },
  southernring: {
    kind: 'nebula', kindLabel: 'A dying star’s cloud', name: 'The Southern Ring Nebula', short: 'Southern Ring', color: '#9fd8ff', range: [1, 8000], pri: 3, thumb: true,
    tagline: 'A dying star’s bubble, seen by the Webb telescope.',
    chips: ['ring', 'helix'],
    picture: pic('southernring', 'Glowing shells of gas, blue inside and orange outside', 'The Southern Ring Nebula, seen by the James Webb Space Telescope in 2022.'),
    facts: [
      { icon: '👯', text: 'Two stars live in the middle. One of them is dying, and puffed off these shells of gas.' },
      { icon: '🔭', text: 'This picture was one of the first from the James Webb Space Telescope, in 2022.' },
      { icon: '📏', text: 'It is about 2,500 light-years away.' },
    ],
  },
  tarantula: {
    kind: 'nebula', kindLabel: 'A star nursery', name: 'The Tarantula Nebula', short: 'Tarantula', color: '#ffb3c8', range: [150, 90000], pri: 2, thumb: true,
    tagline: 'The biggest, brightest star nursery near us.',
    chips: ['lmc', 'n159'],
    picture: pic('tarantula', 'Glowing threads of gas around a hollow full of blue stars', 'The Tarantula Nebula, seen by the James Webb Space Telescope.'),
    facts: [
      { icon: '🕷️', text: 'Its glowing gas looks like the legs of a spider. That is how it got its name.' },
      { icon: '🌟', text: 'It has some of the heaviest stars ever found. One is about 200 times heavier than the Sun.' },
      { icon: '☁️', text: 'It is not in our galaxy. It is in the Large Magellanic Cloud, about 160,000 light-years away.' },
      { icon: '🇳🇿', text: 'From New Zealand you can see it without a telescope, as a fuzzy spot in the Large Magellanic Cloud.' },
    ],
  },
  n159: {
    kind: 'nebula', kindLabel: 'A star nursery', name: 'N159', short: 'N159', color: '#c8d8ff', range: [80, 20000], pri: 4, thumb: true,
    tagline: 'A stormy star nursery in the Large Magellanic Cloud.',
    chips: ['tarantula', 'lmc'],
    picture: pic('n159', 'Blue and brown clouds of gas and dust', 'N159, seen by Hubble.'),
    facts: [
      { icon: '🌪️', text: 'Hot young stars blow strong winds that carve the gas into ridges and bubbles.' },
      { icon: '👶', text: 'Lots of new stars are being born here.' },
      { icon: '📏', text: 'It is more than 150 light-years across.' },
    ],
  },
  e0102: {
    kind: 'nebula', kindLabel: 'An exploded star', name: 'E0102, an exploded star', short: 'Exploded star', color: '#a8c8ff', range: [150, 60000], pri: 4, thumb: true,
    tagline: 'What is left of a star that blew up in the Small Magellanic Cloud.',
    chips: ['smc'],
    picture: pic('e0102', 'Stars, a pink cloud and a small blue ring', 'The little blue ring near the bottom is what is left of the star.'),
    facts: [
      { icon: '💥', text: 'The little blue ring is what is left of a giant star that exploded. Its light reached us about 1,700 years ago.' },
      { icon: '🌸', text: 'The big pink cloud is a different, much bigger cloud of gas. It just happens to be in the same direction.' },
      { icon: '📏', text: 'It is in the Small Magellanic Cloud, about 200,000 light-years away.' },
    ],
  },
  galcentre: {
    kind: 'region', name: 'Centre of the Milky Way', short: 'Galaxy centre', color: '#ffd59a', range: [2500, 1.2e6], pri: 1, emoji: '🌀',
    tagline: 'A giant black hole lives right in the middle.',
    chips: ['nsc', 'sgra'], chipsTitle: 'Dive in',
    facts: [
      { icon: '🕳️', text: 'The black hole is called Sagittarius A*. You say it “Sadge-ih-tair-ee-us A-star”.' },
      { icon: '⚖️', text: 'It is about 4 million times heavier than the Sun.' },
      { icon: '📏', text: 'It is about 26,000 light-years from us.' },
      { icon: '🌫️', text: 'Thick dust hides it, so astronomers use special telescopes that can see through dust.' },
    ],
  },
  nsc: {
    kind: 'cluster', name: 'The star city', short: 'Star city', color: '#ffd9a8', range: [6, 1500], pri: 2, emoji: '🏙️',
    tagline: 'The most crowded place in the whole Milky Way.',
    chips: ['sgra', 's2'], chipsTitle: 'Dive in',
    facts: [
      { icon: '🏙️', text: 'Millions of stars are packed in here, far closer together than the stars near the Sun.' },
      { icon: '🌟', text: 'If you lived here, your night sky would be full of stars brighter than any star we can see from Earth.' },
      { icon: '🍩', text: 'A huge lumpy ring of dust and gas goes around the middle, like a giant doughnut.' },
      { icon: '🕳️', text: 'Right in the very middle is a giant black hole.' },
    ],
  },
  sgra: {
    kind: 'blackhole', name: 'Sagittarius A*', short: 'Black hole', color: '#d9ccff', range: [1.4e-4, 60], pri: 0, emoji: '🕳️',
    tagline: 'The giant black hole in the middle of our galaxy.',
    chips: ['s2', 'nsc'],
    picture: {
      src: 'tex/eht/sgra.jpg',
      alt: 'A blurry orange ring of light with a dark middle',
      caption: 'A real picture of it, made from the Event Horizon Telescope’s measurements. Seeing it from Earth is like spotting a doughnut on the Moon!',
    },
    facts: [
      { icon: '🕳️', text: 'Its pull is so strong that nothing can get out, not even light. That is why the middle is black.' },
      { icon: '⚖️', text: 'It is about 4 million times heavier than the Sun, squashed into a space smaller than Mercury’s path around the Sun.' },
      { icon: '🔥', text: 'The glowing ring is hot gas whizzing round it so fast that it glows. The side rushing towards you looks brighter.' },
      { icon: '🌈', text: 'Its gravity bends light. That is why you can see the back of the glowing ring, curled over the top and underneath.' },
      { icon: '📸', text: 'In 2017, telescopes all over Earth worked together like one giant telescope to take its picture. It was shown to the world in 2022.' },
      { icon: '🌍', text: 'Don’t worry: it is about 26,000 light-years away, much too far to pull us in.' },
    ],
  },
  s2: {
    kind: 'star', name: 'S2', short: 'S2', color: '#bcd4ff', range: [2e-4, 0.6], pri: 1,
    tagline: 'The star that races round the black hole.',
    chips: ['sgra', 'nsc'],
    facts: [
      { icon: '🏎️', text: 'It goes all the way round the black hole every 16 years.' },
      { icon: '⚡', text: 'At its closest it zooms past at about 7,700 km every second. That’s fast enough to fly from New Zealand to London in under 3 seconds!' },
      { icon: '🔬', text: 'By watching S2 for many years, scientists worked out how heavy the black hole is. They won a Nobel Prize for it in 2020.' },
      { icon: '💙', text: 'It is a big, hot, blue star, more than 10 times heavier than the Sun.' },
      { icon: '⏩', text: 'Time is sped up here: a whole year goes by every second.' },
    ],
  },
  milkyway: {
    kind: 'galaxy', name: 'The Milky Way', short: 'Milky Way (home)', color: '#ffe7a8', range: [1.3e6, 8e9], pri: 0, emoji: '🌌',
    tagline: 'Our home galaxy.',
    facts: [
      { icon: '✨', text: 'It has hundreds of billions of stars. The Sun is just one of them.' },
      { icon: '📏', text: 'It is about 100,000 light-years across.' },
      { icon: '🦕', text: 'The Sun takes about 230 million years to go around it once. Last time we were here, the first dinosaurs were just appearing!' },
      { icon: '🌀', text: 'It is shaped like a spiral with a bar across the middle.' },
    ],
  },
  'arm-ori': {
    kind: 'arm', name: 'Orion Spur', short: 'Orion Spur (our home)', color: '#ffe7a8', range: [12000, 6e5], pri: 2,
    tagline: 'The small arm of stars where the Sun lives.',
    facts: [
      { icon: '🏠', text: 'The Sun and all the stars you can see at night are in this little arm.' },
      { icon: '🌸', text: 'Pink glowing clouds, like the Orion Nebula, are where new stars are being born.' },
    ],
  },
  'arm-per': {
    kind: 'arm', name: 'Perseus Arm', short: 'Perseus Arm', color: '#cfe0ff', range: [15000, 6e5], pri: 3,
    tagline: 'One of the two biggest arms of the Milky Way.',
    facts: [
      { icon: '🌀', text: 'It curls all the way from the bar in the middle to the outside of the galaxy.' },
      { icon: '📏', text: 'It is the next arm out from the Sun, about 6,000 light-years away.' },
    ],
  },
  'arm-sct': {
    kind: 'arm', name: 'Scutum–Centaurus Arm', short: 'Scutum–Centaurus Arm', color: '#cfe0ff', range: [15000, 6e5], pri: 3,
    tagline: 'The other giant arm of the Milky Way.',
    facts: [
      { icon: '🌀', text: 'It starts at the end of the bar and wraps around the galaxy.' },
      { icon: '⭐', text: 'It is packed with young, hot, blue stars.' },
    ],
  },
  'arm-sgr': {
    kind: 'arm', name: 'Sagittarius Arm', short: 'Sagittarius Arm', color: '#cfe0ff', range: [15000, 6e5], pri: 3,
    tagline: 'The arm between us and the middle of the galaxy.',
    facts: [
      { icon: '🔭', text: 'When you look towards the middle of the Milky Way, you look through this arm.' },
      { icon: '🌸', text: 'Famous star nurseries like the Eagle Nebula are in it.' },
    ],
  },
  'arm-out': {
    kind: 'arm', name: 'Outer Arm', short: 'Outer Arm', color: '#cfe0ff', range: [15000, 6e5], pri: 4,
    tagline: 'A faint arm near the edge of the galaxy.',
    facts: [
      { icon: '🌌', text: 'Out here the stars are fewer and further apart.' },
      { icon: '🌀', text: 'It starts near the middle of the galaxy on the far side, as the Norma Arm.' },
    ],
  },
  lmc: {
    kind: 'galaxy', name: 'Large Magellanic Cloud', short: 'Large Magellanic Cloud', color: '#d8e2ff', range: [20000, 1.2e7], pri: 2, emoji: '☁️',
    tagline: 'A small galaxy that goes around the Milky Way.',
    chips: ['tarantula', 'n159', 'smc'],
    picture: pic('n159', 'Glowing blue and brown clouds of gas', 'Part of the Large Magellanic Cloud up close: a star nursery called N159, seen by Hubble.'),
    facts: [
      { icon: '🇳🇿', text: 'You can see it from New Zealand on a dark night. It looks like a little fuzzy cloud.' },
      { icon: '📏', text: 'It is about 160,000 light-years away.' },
      { icon: '🌸', text: 'It has a giant star nursery called the Tarantula Nebula.' },
    ],
  },
  smc: {
    kind: 'galaxy', name: 'Small Magellanic Cloud', short: 'Small Magellanic Cloud', color: '#d8e2ff', range: [20000, 1.2e7], pri: 3, emoji: '☁️',
    tagline: 'The Large Magellanic Cloud’s little sister.',
    chips: ['e0102', 'lmc'],
    picture: pic('e0102', 'Stars, a pink cloud and a small blue ring', 'A star that exploded in the Small Magellanic Cloud: it’s the little blue ring near the bottom.'),
    facts: [
      { icon: '🇳🇿', text: 'You can see it from New Zealand too, near the Large Magellanic Cloud.' },
      { icon: '📏', text: 'It is about 200,000 light-years away.' },
      { icon: '🤝', text: 'The two Clouds pull on each other and on the Milky Way as they go around.' },
    ],
  },
  andromeda: {
    kind: 'galaxy', name: 'Andromeda Galaxy', short: 'Andromeda', color: '#e6dcff', range: [80000, 6e7], pri: 1, thumb: true,
    tagline: 'The nearest big galaxy to ours.',
    chips: ['triangulum'],
    picture: pic('andromeda', 'A big spiral galaxy seen from the side, with two small fuzzy galaxies near it', 'A photo of Andromeda taken from Earth by Guillermo Ferla. The two smaller blobs are little galaxies that go around it.'),
    facts: [
      { icon: '📏', text: 'It is 2.5 million light-years away. Its light left long before there were woolly mammoths!' },
      { icon: '✨', text: 'It has about a trillion stars, even more than the Milky Way.' },
      { icon: '💥', text: 'In a few billion years it may crash into the Milky Way, and the two will join together.' },
      { icon: '👀', text: 'It is the farthest thing most people can see with just their eyes, as a faint smudge.' },
    ],
  },
  triangulum: {
    kind: 'galaxy', name: 'The Triangulum Galaxy', short: 'Triangulum', color: '#dfe4ff', range: [30000, 4e7], pri: 3, thumb: true,
    tagline: 'The third biggest galaxy in our group.',
    chips: ['andromeda'],
    picture: pic('triangulum', 'The middle of a spiral galaxy, full of stars', 'Hubble put lots of pictures together to make this view of its middle.'),
    facts: [
      { icon: '📏', text: 'It is about 2.7 million light-years away, a little farther than Andromeda.' },
      { icon: '🌀', text: 'It is a spiral galaxy, a bit more than half as wide as the Milky Way.' },
      { icon: '👀', text: 'On a very dark night, some people can just see it without a telescope.' },
    ],
  },
  whirlpool: {
    kind: 'galaxy', name: 'The Whirlpool Galaxy', short: 'Whirlpool', color: '#dfe4ff', range: [50000, 4e8], pri: 3, thumb: true,
    tagline: 'A spiral galaxy pulling on its little neighbour.',
    picture: pic('whirlpool', 'A spiral galaxy with a smaller galaxy at the end of one arm', 'The Whirlpool Galaxy and its small neighbour, seen by Hubble.'),
    facts: [
      { icon: '🌀', text: 'It has two beautiful spiral arms. In 1845 it was the first galaxy where people saw a spiral shape.' },
      { icon: '🤝', text: 'The small galaxy at the end of one arm is pulling on it. That helps make the arms so bright.' },
      { icon: '📏', text: 'It is about 31 million light-years away.' },
    ],
  },
  pinwheel: {
    kind: 'galaxy', name: 'The Pinwheel Galaxy', short: 'Pinwheel', color: '#dfe4ff', range: [50000, 4e8], pri: 3, thumb: true,
    tagline: 'A huge spiral galaxy we see from the top.',
    picture: pic('pinwheel', 'A big spiral galaxy seen from straight above', 'The Pinwheel Galaxy, seen by Hubble.'),
    facts: [
      { icon: '🌀', text: 'We see it from the top, so it looks like a pinwheel.' },
      { icon: '📏', text: 'It is about 170,000 light-years across, much wider than the Milky Way.' },
      { icon: '💥', text: 'In 2011 a star in it exploded. People could see it with telescopes in their back gardens.' },
      { icon: '🔭', text: 'It is about 21 million light-years away.' },
    ],
  },
  sombrero: {
    kind: 'galaxy', name: 'The Sombrero Galaxy', short: 'Sombrero', color: '#fff0d8', range: [50000, 4e8], pri: 3, thumb: true,
    tagline: 'A galaxy that looks like a big Mexican hat.',
    picture: pic('sombrero', 'A galaxy seen from the side with a bright middle and a dark band', 'The Sombrero Galaxy, seen by Hubble.'),
    facts: [
      { icon: '👒', text: 'We see it almost from the side. Its dark band of dust looks like the brim of a hat.' },
      { icon: '🕳️', text: 'In its bright middle is a giant black hole, about a billion times heavier than the Sun.' },
      { icon: '📏', text: 'It is about 30 million light-years away.' },
    ],
  },
  cena: {
    kind: 'galaxy', name: 'Centaurus A', short: 'Centaurus A', color: '#ffe2c4', range: [30000, 2e8], pri: 3, thumb: true,
    tagline: 'A galaxy with a dark belt of dust.',
    picture: pic('cena', 'A thick dark band of dust in front of glowing stars', 'Hubble’s close-up of the middle of Centaurus A.'),
    facts: [
      { icon: '💥', text: 'Long ago it crashed into a smaller galaxy. The dark belt of dust is left over from the crash.' },
      { icon: '🕳️', text: 'Its giant black hole shoots out jets that stretch farther than the whole galaxy.' },
      { icon: '🇳🇿', text: 'You can spot it in the southern sky with binoculars.' },
      { icon: '📏', text: 'It is about 12 million light-years away.' },
    ],
  },
  m87: {
    kind: 'galaxy', name: 'Messier 87', short: 'M87', color: '#ffe9c8', range: [50000, 6e8], pri: 2, thumb: true,
    tagline: 'A giant ball of stars with a famous black hole.',
    chips: ['virgo'],
    picture: { src: 'tex/eht/m87.jpg', alt: 'A blurry orange ring of light with a dark middle', caption: 'The first picture of a black hole ever: the one in the middle of M87, made from the Event Horizon Telescope’s measurements in 2019.' },
    facts: [
      { icon: '⚽', text: 'It is a giant ball-shaped galaxy with trillions of stars.' },
      { icon: '🕳️', text: 'In its middle is a black hole 6.5 billion times heavier than the Sun. It was the first black hole ever photographed.' },
      { icon: '🔦', text: 'The blue line is a jet of gas shooting out from near the black hole, almost as fast as light.' },
      { icon: '📏', text: 'It is about 55 million light-years away, in a big crowd of galaxies called the Virgo Cluster.' },
    ],
  },
  virgo: {
    kind: 'region', kindLabel: 'A crowd of galaxies', name: 'The Virgo Cluster', short: 'Virgo Cluster', color: '#ffe7c0', range: [2e6, 3e9], pri: 2, emoji: '👥',
    tagline: 'A giant crowd of galaxies.',
    chips: ['m87'],
    facts: [
      { icon: '👥', text: 'More than a thousand galaxies live together here, pulling on each other with gravity.' },
      { icon: '📏', text: 'It is about 55 million light-years away.' },
      { icon: '🏠', text: 'Our Milky Way and its neighbours are slowly being pulled towards it.' },
    ],
  },
  deepfield: {
    kind: 'deepfield', name: 'The Hubble Ultra Deep Field', short: 'Deep Field', color: '#ffd9b0', range: [1e6, 8e9], pri: 1, thumb: 'hudf',
    tagline: 'Almost every dot is a whole galaxy!',
    actions: [{ id: 'flyin', icon: '🚀', label: 'Fly through it' }],
    picture: pic('hudf', 'Black space full of tiny galaxies of every shape and colour', 'The real Hubble Ultra Deep Field picture.'),
    facts: [
      { icon: '🔭', text: 'Hubble stared at one tiny dark patch of sky for about 11 days in total. A grain of sand held at arm’s length would cover it!' },
      { icon: '🌌', text: 'Almost every dot is a galaxy with billions of stars. There are about 10,000 galaxies in the picture.' },
      { icon: '⏳', text: 'Light from the farthest ones set off more than 13 billion years ago, long before Earth was made.' },
      { icon: '🧭', text: 'In real life these galaxies are spread over billions of light-years. Here they are squeezed closer together, so you can fly through them.' },
    ],
  },
};
