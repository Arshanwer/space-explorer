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
];

export const DEEP_DOCK = ['sun', 'proxima', 'alphacen', 'barnard', 'wolf359', 'sirius', 'vega', 'arcturus', 'matariki',
  'southerncross', 'betelgeuse', 'rigel', 'polaris', 'canopus', 'antares', 'deneb', 'galcentre', 'nsc', 'sgra', 'lmc', 'smc', 'andromeda'];

const star = (o) => ({ kind: 'star', ...o });

export const DEEP = {
  sun: star({
    name: 'The Sun', short: 'Sun', color: '#ffd27a', range: [0, 9000], pri: 0,
    tagline: 'Our star, seen from far away.',
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
    kind: 'galaxy', name: 'The Milky Way', short: 'Milky Way', color: '#cfd8ff', range: [0, 0], pri: 9, emoji: '🌌',
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
    kind: 'galaxy', name: 'Large Magellanic Cloud', short: 'Large Magellanic Cloud', color: '#d8e2ff', range: [20000, 3e6], pri: 2, emoji: '☁️',
    gal: [280.47, -32.89, 163000],
    tagline: 'A small galaxy that goes around the Milky Way.',
    facts: [
      { icon: '🇳🇿', text: 'You can see it from New Zealand on a dark night. It looks like a little fuzzy cloud.' },
      { icon: '📏', text: 'It is about 160,000 light-years away.' },
      { icon: '🌸', text: 'It has a giant star nursery called the Tarantula Nebula.' },
    ],
  },
  smc: {
    kind: 'galaxy', name: 'Small Magellanic Cloud', short: 'Small Magellanic Cloud', color: '#d8e2ff', range: [20000, 3e6], pri: 3, emoji: '☁️',
    gal: [302.8, -44.3, 200000],
    tagline: 'The Large Magellanic Cloud’s little sister.',
    facts: [
      { icon: '🇳🇿', text: 'You can see it from New Zealand too, near the Large Magellanic Cloud.' },
      { icon: '📏', text: 'It is about 200,000 light-years away.' },
      { icon: '🤝', text: 'The two Clouds pull on each other and on the Milky Way as they go around.' },
    ],
  },
  andromeda: {
    kind: 'galaxy', name: 'Andromeda Galaxy', short: 'Andromeda', color: '#e6dcff', range: [80000, 3e7], pri: 2, emoji: '🌌',
    gal: [121.17, -21.57, 2.54e6],
    tagline: 'The nearest big galaxy to ours.',
    facts: [
      { icon: '📏', text: 'It is 2.5 million light-years away. Its light left long before there were woolly mammoths!' },
      { icon: '✨', text: 'It has about a trillion stars, even more than the Milky Way.' },
      { icon: '💥', text: 'In a few billion years it may crash into the Milky Way, and the two will join together.' },
    ],
  },
};
