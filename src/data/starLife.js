// The life of a star, in two stories: a star like our Sun, and a giant star.
// Written for 6–8 year olds and checked against NASA/ESA explainers. Ages are rounded.
//
// look: which 3D scene to build (see src/scene/starStory.js)
// visit: a real place to fly to (an id in src/data/deep.js, or 'sun')
// inside: layers for "Slice it open" (r0/r1 = fractions of the radius, like the planets).
//   The middles of giant stars are drawn much bigger than they really are, so you can see them.

const cloud = {
  id: 'cloud', look: 'cloud', icon: '☁️', title: 'A cloud of gas and dust', age: 'The start',
  text: 'Every star starts inside a giant cold cloud of gas and dust. Gravity pulls part of the cloud together into a tight clump.',
  visit: 'orion', visitName: 'the Orion Nebula',
};

export const STAR_PATHS = {
  sun: {
    name: 'A star like our Sun', icon: '☀️',
    stages: [
      cloud,
      {
        id: 'baby', look: 'baby', icon: '👶', title: 'A baby star', age: 'About 100,000 years old',
        text: 'The clump gets squeezed so tight that it heats up and starts to glow. A flat disc of dust spins around it, and jets of gas shoot out of its top and bottom. Planets can grow in a disc like this!',
        visit: 'mystic', visitName: 'Mystic Mountain',
      },
      {
        id: 'sun', look: 'sun', icon: '☀️', title: 'A grown-up star', age: 'Now: 4.6 billion years old',
        text: 'Its middle is now hot enough to squash hydrogen together into helium. That makes the light and heat. Our Sun is here now, about halfway through its life.',
        compare: 'earth', visit: 'sun', visitName: 'the Sun',
        inside: [
          { name: 'Surface', kid: 'The glowing part we see. Hotter than any oven on Earth.', r0: 0.97, r1: 1.0, color: '#ffd36a', glow: 0.25 },
          { name: 'Bubbling layer', kid: 'Hot gas bubbles up and sinks down, like boiling soup.', r0: 0.7, r1: 0.97, color: '#f07a1a', glow: 0.2 },
          { name: 'Glowing layer', kid: 'Light bounces around in here for thousands of years before it gets out.', r0: 0.25, r1: 0.7, color: '#d9461a', glow: 0.25 },
          { name: 'Core', kid: 'The hottest place. Hydrogen is squashed into helium here. That makes all the Sun’s light.', r0: 0, r1: 0.25, color: '#fff2c4', glow: 1.1 },
        ],
      },
      {
        id: 'redgiant', look: 'redgiant', icon: '🔴', title: 'A red giant', age: 'In about 5 billion years',
        text: 'When the hydrogen in its middle runs out, the star swells up into a huge red giant. It will be so big it swallows Mercury and Venus, and maybe even Earth!',
        orbits: ['mercury', 'venus', 'earth'], visit: 'gacrux', visitName: 'Gacrux, a red giant in the Southern Cross',
        inside: [
          { name: 'Surface', kid: 'Cooler than the Sun’s surface, so it glows orange-red.', r0: 0.97, r1: 1.0, color: '#ff8a4a', glow: 0.2 },
          { name: 'Puffy outside', kid: 'A huge bubbling layer of gas, so spread out it is thinner than air.', r0: 0.2, r1: 0.97, color: '#d0532a', glow: 0.15 },
          { name: 'Burning shell', kid: 'Hydrogen still burns here, in a thin shell around the middle.', r0: 0.11, r1: 0.2, color: '#ffb347', glow: 0.8 },
          { name: 'Helium core', kid: 'Squashed helium ash. Really it is tiny, about as big as Earth!', r0: 0, r1: 0.11, color: '#fff3d6', glow: 1.0 },
        ],
      },
      {
        id: 'nebula', look: 'nebula', icon: '💍', title: 'Puffing off its outsides', age: 'In about 8 billion years',
        text: 'Then the star gently puffs its outside layers off into space. They glow in beautiful colours for about 10,000 years, then fade away.',
        visit: 'ring', visitName: 'the Ring Nebula',
      },
      {
        id: 'whitedwarf', look: 'whitedwarf', icon: '⚪', title: 'A white dwarf', age: 'For billions of years after',
        text: 'What is left is the star’s tiny hot middle: a white dwarf, about as big as Earth. A teaspoon of it would weigh as much as an elephant! It slowly cools down for billions of years.',
        compare: 'earthsame', visit: 'sirius', visitName: 'Sirius, which has a white dwarf partner',
        inside: [
          { name: 'Thin skin', kid: 'A very thin layer of hydrogen and helium gas.', r0: 0.97, r1: 1.0, color: '#dfe9ff', glow: 0.4 },
          { name: 'Helium layer', kid: 'A layer of helium, squashed very tight.', r0: 0.9, r1: 0.97, color: '#b9cbff', glow: 0.35 },
          { name: 'Carbon crystal', kid: 'Carbon and oxygen squashed so hard they turn into a crystal, a bit like a giant diamond!', r0: 0, r1: 0.9, color: '#eef3ff', glow: 0.6 },
        ],
      },
    ],
  },
  giant: {
    name: 'A giant star', icon: '💙',
    stages: [
      { ...cloud, text: 'Giant stars start the same way: inside a cold cloud of gas and dust, where gravity pulls a really big clump together.', visit: 'eagle', visitName: 'the Pillars of Creation' },
      {
        id: 'baby', look: 'baby', icon: '👶', title: 'A big baby star', age: 'About 100,000 years old',
        text: 'The clump is so heavy it squeezes itself very hard and gets hot very fast. Strong winds and jets blow away the gas around it.',
        visit: 'orion', visitName: 'the Orion Nebula',
      },
      {
        id: 'bluegiant', look: 'bluegiant', icon: '💙', title: 'A giant blue star', age: 'A few million years old',
        text: 'Giant stars are bigger, hotter, bluer and much brighter than the Sun. They use up their fuel so fast that they only live for millions of years. The Sun will live for about 10 billion!',
        compare: 'sun', visit: 'mimosa', visitName: 'Mimosa, a blue giant in the Southern Cross',
        inside: [
          { name: 'Surface', kid: 'Much hotter than the Sun’s surface, so it glows blue-white.', r0: 0.98, r1: 1.0, color: '#cfe0ff', glow: 0.5 },
          { name: 'Glowing layer', kid: 'Light slowly works its way out through here.', r0: 0.3, r1: 0.98, color: '#6f8fe0', glow: 0.35 },
          { name: 'Churning core', kid: 'The middle of a giant star bubbles and churns as it burns its fuel super fast.', r0: 0, r1: 0.3, color: '#f4f8ff', glow: 1.1 },
        ],
      },
      {
        id: 'supergiant', look: 'supergiant', icon: '🔴', title: 'A red supergiant', age: 'Near the end',
        text: 'When its fuel runs low, it swells into an enormous red supergiant. If one sat where the Sun is, it would reach out past Mars!',
        orbits: ['earth', 'mars', 'jupiter'], visit: 'betelgeuse', visitName: 'Betelgeuse',
        inside: [
          { name: 'Puffy outside', kid: 'A gigantic cloud of hydrogen gas, bubbling and boiling.', r0: 0.55, r1: 1.0, color: '#d24a2a', glow: 0.15 },
          { name: 'Helium layer', kid: 'Helium burns here and turns into carbon.', r0: 0.4, r1: 0.55, color: '#ff8c3a', glow: 0.35 },
          { name: 'Carbon and oxygen', kid: 'Carbon and oxygen burn into heavier stuff, like neon and silicon.', r0: 0.26, r1: 0.4, color: '#ffc04a', glow: 0.5 },
          { name: 'Silicon layer', kid: 'Silicon, the stuff in sand, burns into iron.', r0: 0.13, r1: 0.26, color: '#fff08a', glow: 0.7 },
          { name: 'Iron core', kid: 'Iron can’t burn. When the iron core gets too big, the star is about to explode!', r0: 0, r1: 0.13, color: '#c9d2e0', glow: 0.9 },
        ],
      },
      {
        id: 'supernova', look: 'supernova', icon: '💥', title: 'Supernova!', age: 'In less than a second',
        text: 'The iron core suddenly collapses, and the star blows itself apart in a giant explosion called a supernova. For a few weeks it can shine brighter than a whole galaxy!',
        visit: 'crab', visitName: 'the Crab Nebula',
      },
      {
        id: 'neutron', look: 'neutron', icon: '💫', title: 'A neutron star', age: 'What is left',
        text: 'The squashed core left behind is a neutron star: only about 20 km wide, but heavier than the Sun! Many spin round very fast, flashing beams of light like a lighthouse. Those are called pulsars.',
        visit: 'crabpulsar', visitName: 'the Crab Pulsar',
        inside: [
          { name: 'Crust', kid: 'A hard crust of iron, smoother than a marble. Its tallest mountains are less than a millimetre high!', r0: 0.93, r1: 1.0, color: '#b9c7dc', glow: 0.3 },
          { name: 'Nuclear pasta', kid: 'Squashed so hard it makes shapes scientists call nuclear pasta, like spaghetti and lasagne!', r0: 0.84, r1: 0.93, color: '#f2c46b', glow: 0.4 },
          { name: 'Sea of neutrons', kid: 'Tiny particles called neutrons, packed tighter than anything on Earth.', r0: 0.38, r1: 0.84, color: '#6c8cff', glow: 0.45 },
          { name: 'Mystery middle', kid: 'Nobody knows what is in the very middle. Scientists are still trying to find out!', r0: 0, r1: 0.38, color: '#d58cff', glow: 0.8 },
        ],
      },
      {
        id: 'blackhole', look: 'blackhole', icon: '🕳️', title: 'Or… a black hole', age: 'For the very biggest stars',
        text: 'If the star was really, really big, not even a neutron star can hold up. It squashes into a black hole: its pull is so strong that not even light can get out.',
        visit: 'sgra', visitName: 'Sagittarius A*, a much bigger black hole',
        honest: {
          title: 'We can’t slice a black hole',
          facts: [
            { icon: '🤷', text: 'Nobody knows what is inside a black hole.' },
            { icon: '🔦', text: 'Nothing can get back out of one: not light, not a spaceship, not even a message. So we can never look inside.' },
            { icon: '🧮', text: 'Scientists’ best ideas say everything gets squeezed into a tiny point in the middle. But they think those ideas stop working there.' },
            { icon: '🔭', text: 'It is one of the biggest mysteries in science. Maybe one day, you will help work it out!' },
          ],
        },
      },
    ],
  },
};
