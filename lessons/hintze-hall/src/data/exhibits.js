// The exhibits you can click in Hintze Hall, and where to stand to see them.
// Positions are in the scan's own coordinates (metres): x across the hall (− west, + east),
// y up (ground floor ≈ 1.25), z along it (− entrance/south, + main staircase/north).
// Facts are from the Natural History Museum's own pages (nhm.ac.uk) unless noted; see the README.

export const FLOORS = {
  ground: { name: 'Ground floor', y: 1.25 },
  landing: { name: 'Staircase landing', y: 4.5 },
  first: { name: 'First-floor balconies', y: 7.6 },
  second: { name: 'Second floor', y: 14.7 },
};

export const EXHIBITS = {
  hope: {
    name: 'Hope the blue whale',
    kind: 'Blue whale skeleton (Balaenoptera musculus)',
    floor: 'Hanging over the ground floor',
    // a chain of spheres along her body, head (south, low) to tail (north, high)
    hit: [[0, 6.5, -4.5, 2.2], [0, 9.5, 0, 2.2], [0, 12, 4, 2], [0, 13.6, 8, 1.8], [0, 14.5, 12, 1.6]],
    marker: [0, 4.6, -6.5],
    view: { pos: [0, 1.25, -13], look: [0, 9, 2] },
    summary: 'The largest animal that has ever lived, diving through the hall in a lunge-feeding pose.',
    facts: [
      '25.2 metres long and about 4.5 tonnes, with 221 bones.',
      'She was found stranded in Wexford, Ireland, in March 1891. The Museum bought her that year and she arrived in 1892.',
      'She was first shown to the public in 1934 and spent 81 years in the Mammal Hall.',
      'Hung here in 2017, replacing Dippy the Diplodocus cast, which had stood in the hall since 1979.',
      'Her jaw is 4.2 m above the floor; the arch of her back, the highest point, is 13.5 m up.',
    ],
    didYouKnow: 'She is called Hope because blue whales are recovering after decades of commercial hunting nearly wiped them out: a symbol of humanity’s power to shape a sustainable future.',
  },
  darwin: {
    name: 'Charles Darwin statue',
    kind: 'Marble statue by Sir Joseph Edgar Boehm',
    floor: 'Staircase landing',
    hit: [[0, 6.6, 25.3, 1.5]],
    marker: [0, 9.3, 25.3],
    view: { pos: [0, 4.5, 21.2], look: [0, 6.6, 25.3] },
    summary: 'Charles Darwin, whose theory of evolution by natural selection changed how we understand life on Earth.',
    facts: [
      'Unveiled here on the main staircase on 9 June 1885, three years after Darwin’s death.',
      'It was later moved away, and a bronze statue of Sir Richard Owen, the Museum’s founder, stood here instead from 1927 to 2008.',
      'In 2008 the 2.2-tonne marble Darwin came back to this spot for the 200th anniversary of his birth (1809). Owen’s statue was moved up to the balcony at the other end of the hall.',
    ],
    didYouKnow: 'Owen and Darwin disagreed about evolution: Owen was one of Darwin’s fiercest critics. Today Darwin looks down the hall at the animals his theory explains.',
  },
  sequoia: {
    name: 'Giant sequoia slice',
    kind: 'Sequoiadendron giganteum — the world’s biggest tree species',
    floor: 'Second floor, south end',
    hit: [[0, 17.2, -27.8, 2.6]],
    marker: [0, 20.2, -27.6],
    view: { pos: [2.4, 14.7, -24.2], look: [0, 17.2, -27.8] },
    summary: 'A slice cut from a giant sequoia tree felled in California in the 1890s.',
    facts: [
      'The tree was about 1,300 years old and 101 metres tall when it was felled.',
      'The slice has been in the Museum since 1893 and was moved to this upper balcony in 1971.',
      'Count the growth rings: each light and dark pair is one year of the tree’s life.',
    ],
    didYouKnow: 'This tree started growing around 600 CE — about 1,300 years before the Museum opened. Its rings record every year in between.',
  },
  ceiling: {
    name: 'The painted ceiling',
    kind: '162 botanical ceiling panels',
    floor: 'Look up! (best seen from the second floor)',
    hit: [[0, 22.5, -12, 4], [0, 22.5, -4, 4], [0, 22.5, 4, 4], [0, 22.5, 12, 4], [0, 22.5, 20, 4]],
    marker: [0, 19.5, 6],
    view: { pos: [0, 14.7, -23.2], look: [0, 22.5, 2] },
    summary: 'The ceiling is decorated with 162 panels of plants that people moved around the world.',
    facts: [
      'They show plants grown for trade, food, medicine or beauty: lemons, tea, cotton, cacao, tobacco, opium poppies, pineapples, English oak and many more.',
      'Painted by the Manchester firm Best and Lea.',
      'The ceiling was cut from the plans to save money, but the architect Alfred Waterhouse insisted it was put back.',
      'Some panels were cleaned and restored when the hall was redeveloped in 2017.',
    ],
    didYouKnow: 'Many of these plants were carried between continents by trade and empire, changing what people grew, ate and sold around the world.',
  },
  building: {
    name: 'A cathedral to nature',
    kind: 'Architecture by Alfred Waterhouse',
    floor: 'Ground floor, entrance',
    hit: [[-4.6, 3.2, -16.5, 0.6]],
    marker: [-4.6, 3.2, -16.5],
    view: { pos: [0, 1.25, -21], look: [0, 6, -5] },
    summary: 'Hintze Hall (formerly the Central Hall) is the heart of the Natural History Museum, which opened in 1881.',
    facts: [
      'Designed by Alfred Waterhouse and opened to the public on 18 April 1881.',
      'The whole building is clad in terracotta tiles moulded with plants and animals.',
      'Sir Richard Owen, the Museum’s founder, wanted a grand building where everyone could see the wonders of nature.',
      'The hall was redeveloped in 2017, when Hope the blue whale replaced Dippy and ten star specimens were placed in the side bays.',
    ],
    didYouKnow: 'Owen asked for living species to decorate one wing of the building and extinct species the other.',
  },
  mastodon: {
    name: 'American mastodon',
    kind: 'Fossil skeleton — Mammut americanum',
    floor: 'Ground floor, west bay',
    hit: [[-12.4, 3, -15.5, 2.4]],
    marker: [-11, 6, -15.5],
    view: { pos: [-5.2, 1.25, -15.5], look: [-12.4, 4.4, -15.5] },
    summary: 'An Ice Age relative of elephants, which lived in North America until about 13,000 years ago.',
    facts: [
      'Bones were found by a farmer in Missouri in 1840. The fossil showman Albert Koch dug them up.',
      'Koch built a “Missouri Leviathan” twice the size of a real mastodon: he added extra vertebrae and ribs, put wood between the bones and fixed the tusks sticking out sideways.',
      'Richard Owen bought it for the Museum in 1844 and rebuilt it correctly: the first accurate mastodon mount anywhere.',
    ],
    didYouKnow: 'Owen agreed to pay Koch $2,000 plus $1,000 a year for life. Koch lived another 22 years, so it cost about $24,000!',
  },
  giraffes: {
    name: 'Giraffes',
    kind: 'A giraffe and a giraffe skeleton (Giraffa)',
    floor: 'Ground floor, east bay',
    hit: [[12.4, 3.5, -15.5, 2.4]],
    marker: [11, 6.4, -15.5],
    view: { pos: [7.5, 1.25, -15.5], look: [12.4, 3.6, -15.5] },
    summary: 'The tallest living animal, shown both as a mounted giraffe and as a skeleton side by side.',
    facts: [
      'Compare the two: the skeleton shows how the long neck and legs are built.',
      'A giraffe’s neck has just seven vertebrae, the same number as yours — each one is simply very long.',
      'A tall giraffe can reach leaves more than 5 metres above the ground.',
    ],
    didYouKnow: 'Darwin used the giraffe’s neck as an example of how small advantages can add up over many generations.',
  },
  coral: {
    name: 'Turbinaria coral',
    kind: 'Coral colony (Turbinaria)',
    floor: 'Ground floor, east bay',
    hit: [[11.6, 1.9, -3, 1.1]],
    marker: [11.3, 3.4, -3],
    view: { pos: [7.5, 1.3, -3], look: [11.6, 1.9, -3] },
    summary: 'A 300-kilogram coral, about 120 years old.',
    facts: [
      'A coral is a colony of thousands of tiny animals called polyps.',
      'The polyps build a hard skeleton of calcium carbonate, layer by layer, year after year.',
      'Corals like this build reefs: home to about a quarter of all ocean species.',
    ],
    didYouKnow: 'Reef-building corals get most of their food from tiny algae living inside them. Too-warm water makes them expel the algae and “bleach”.',
  },
  marlin: {
    name: 'Atlantic blue marlin',
    kind: 'Fish (Makaira nigricans)',
    floor: 'Ground floor, west bay',
    hit: [[-11.2, 2.6, -3, 1.3]],
    marker: [-10.9, 4.8, -3],
    view: { pos: [-7.5, 1.3, -3], look: [-11.2, 2.6, -3] },
    summary: 'One of the ocean’s fastest and largest predatory fish.',
    facts: [
      'It hunts in the open ocean, using its long, sharp bill to slash through shoals of fish and squid.',
      'Its streamlined body and crescent-shaped tail are built for speed.',
      'Blue marlin can grow to more than 4 metres long.',
    ],
    didYouKnow: 'Marlin can change the colour of their skin, flashing bright stripes when they are excited or hunting.',
  },
  meteorite: {
    name: 'Meteorite',
    kind: 'A rock as old as the Solar System',
    floor: 'Ground floor, west bay',
    hit: [[-11.6, 1.9, 9.4, 1]],
    marker: [-11.4, 3.2, 9.4],
    view: { pos: [-7.5, 1.3, 9.4], look: [-11.6, 1.8, 9.4] },
    summary: 'A piece of space rock about 4.5 billion years old, from the very beginning of the Solar System.',
    facts: [
      'Meteorites are pieces of asteroids that survived falling through Earth’s atmosphere.',
      'Most are older than any rock on Earth: Earth’s surface has been recycled by plate tectonics, but asteroids have barely changed.',
      'Scientists study meteorites to learn how the planets formed.',
    ],
    didYouKnow: 'Thousands of tonnes of space dust and rock land on Earth every year — most of it is too small to notice.',
  },
};

export const ORDER = ['hope', 'darwin', 'sequoia', 'ceiling', 'building', 'mastodon', 'giraffes', 'coral', 'marlin', 'meteorite'];

/** Where you start: inside the entrance, looking up the hall at Hope. */
export const START = { pos: [0, 1.25, -21], look: [0, 6, 0] };
