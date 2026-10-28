import type { Messages } from '../../types';

export default {
  category: { home: 'Home widget', tool: 'Tool' },
  sticky: {
    name: 'Sticky notes',
    summary: 'Colorful Windows 7-style notes that float above the screen.',
    description: {
      p1: 'Stick quick thoughts anywhere on the screen. The notes stay put when you change pages, as if taped to your monitor.',
      p2: 'You can turn a note into a regular note at any time: its first line becomes the title, the rest the content.',
    },
    features: {
      f1: 'Drag, resize from the corner, 6 colors',
      f2: 'Show on every page or only on the home page',
      f3: 'Hide / show on this device with Alt Y',
      f4: 'Turn into a permanent note with “Save as note”',
      f5: 'On phones, colored squares in the bottom right open on tap',
    },
    usage: 'Right-click an empty spot on the home page and choose “Add sticky note”, or press Ctrl K → “New sticky note”.',
    dataLabel: 'all your sticky notes and their settings',
  },
  stickyArt: {
    name: 'Patterned note paper',
    summary: 'Patterned paper for sticky notes, drawn as if in pencil: flowers, city, sea, cars, chemistry…',
    description: {
      p1: 'Like the patterned note pads or napkins sold in shops: the whole sheet is covered with small colored-pencil drawings.',
      p2: 'What you write stays readable on top of the pattern. If you uninstall the plugin, patterned notes go back to a plain color; nothing is deleted.',
    },
    features: {
      f1: '12 patterns: flowers, lavender, city, leaves, sea, mountains, night, cherry blossom, cars, Wild West, math, chemistry',
      f2: 'Pick one with a single click from the color menu',
      f3: 'On phones, the squares in the bottom right show a small piece of the pattern',
    },
    usage: 'Click a sticky note’s ⋯ button or right-click its header, then pick a pattern below the colors.',
    dataLabel: 'the pattern choices on your notes (the notes stay, back in plain colors)',
  },
  stickyShape: {
    name: 'Shaped note paper',
    summary: 'Like the shaped Post-its from the stationery shop: sticky notes shaped like a car, a flower, a house, a heart, a cloud, a cup or an arrow.',
    description: {
      p1: 'The paper itself is the shape: a car seen from the side, a daisy, a house, a heart… You still pick the paper color.',
      p2: 'Add as many pieces of text to a note as you like and drag each one wherever you want it. Resizing keeps the shape’s proportions, and the text grows and shrinks with it. If you uninstall the plugin, shaped notes go back to rectangles; nothing is deleted.',
    },
    features: {
      f1: 'Shapes: car, daisy, house, heart, cloud, coffee cup and arrows in four directions',
      f2: 'Click an empty spot on the paper to add new text there; drag text to move it',
      f3: 'Resizing keeps the shape, and the text grows with the paper',
    },
    usage: 'Click a sticky note’s ⋯ button, then pick a shape below the colors. Pick the first square to go back to a rectangle.',
    dataLabel: 'the shape choices on your notes (the notes stay, back as rectangles)',
  },
  otd: {
    name: 'Newspaper: On this day',
    summary: '“On this day” events laid out like an old newspaper page on your home page.',
    description: {
      p1: 'Events, births and deaths that happened on today’s date, taken from Wikipedia and set in columns like a newspaper.',
      p2: 'The front page carries the day’s headline event; turn the pages to read the rest.',
    },
    features: {
      f1: 'Turkish or English Wikipedia as the source',
      f2: 'Headline, columns and page turning',
      f3: 'Every event links to its Wikipedia article',
    },
    usage: 'Appears at the bottom of the home page; change its position in Settings > Home page.',
    dataLabel: 'the language choice and its place on the home page',
  },
  drivemeter: {
    name: 'Storage meter',
    summary: 'Shows how much space is left in your Google Drive and how much of it Thalamus takes up.',
    description: {
      p1: 'A two-dial meter that floats above the screen. The big dial shows how full your Google Drive is; the small dial shows how much space Thalamus uses in it.',
      p2: 'Pick one of four views: a faithful Windows 7 CPU meter, a ring, a pie or a small badge. You can also add it to your home page as a widget.',
    },
    features: {
      f1: 'Win7 CPU meter view: the original plus 5 skins, large and small sizes',
      f2: 'Ring, pie and badge views',
      f3: 'Refreshes on its own at startup and every 10 minutes',
      f4: 'Without Drive, shows the space your browser sets aside on this device',
      f5: 'On phones, a small text badge in the bottom left',
    },
    usage: 'Once installed it appears in the top right; drag it anywhere. Hover and use the ⚙ button to pick a view. Turn on the home page widget in Settings > Home page.',
    dataLabel: 'your view choices, the gadget’s position and its place on the home page',
  },
  wallpaper: {
    name: 'Background',
    summary: 'Puts a scene or a colour behind the app.',
    description: {
      p1: 'The scene you pick sits behind the screen; the sidebar turns to frosted glass and the page floats above it as a translucent card.',
      p2: 'Choose from eight scenes (pixel sky, Windows 7, Aero, desert, mountains, ocean, starry night, forest) and eight colours/gradients.',
    },
    features: {
      f1: '8 scenes, 5 gradients and 3 solid colours',
      f2: 'Scenes dim in dark theme so text stays readable',
      f3: 'Your choice syncs to all your devices',
      f4: 'Works on phones too',
    },
    usage: 'Once installed, previews appear in Settings > Appearance; just click one.',
    dataLabel: 'your background choice',
  },
  clock: {
    name: 'Clock',
    summary: 'An analog clock that floats above the screen, with eight faces.',
    description: {
      p1: 'An analog clock that floats freely above the screen. Drag it anywhere, and choose whether it stays fixed on screen or scrolls with the page.',
      p2: 'Pick from eight faces: classic chrome, night, wood, flower, Roman numerals, Aero glass, station and retro. You can give the clock a name, show another time zone and turn off the second hand.',
    },
    features: {
      f1: '8 clock faces',
      f2: 'Time zone choice and a name shown on the face',
      f3: 'Second hand can be turned off',
      f4: 'Can also be added to the home page as a widget',
      f5: 'On a phone it becomes a small analog badge in the bottom-left corner',
    },
    usage: 'Once installed it appears on the right; drag it anywhere. Hover and use the ⚙ button to pick a face. Time zone and name are in Settings > Clock. Turn on the home page widget in Settings > Home page.',
    dataLabel: 'your face, time zone and name choices, the gadget’s position and its place on the home page',
  },
} satisfies Messages['plugins'];
