import type { Messages } from '../../types';

export default {
  signIn: 'Sign in',
  eyebrow: 'Your personal knowledge atlas',
  title: 'Everything you read, learn and think, connected.',
  lead: 'Thalamus brings your books, papers, courses and vocabulary together in one place and makes the links between them visible. Your notes stay in your own Google Drive.',
  more: 'What can it do?',
  featuresTitle: 'Reading, notes and review in one app',
  features: {
    graph: { title: 'Linked notes', text: 'Link notes to each other and see where every idea leads on the connection map.' },
    collections: { title: 'Collections', text: 'Books, papers, courses, words: each with its own fields, shown as a table, board, gallery or calendar.' },
    pdf: { title: 'PDF reader', text: 'Upload a PDF and get the paper details, abstract and section headings automatically. Highlight as you read and the highlights land in your note.' },
    review: { title: 'Review and study', text: 'Keep what you learn with spaced repetition, and track your study time and reading progress.' },
    daily: { title: 'Journal and calendar', text: 'A page for every day; your dated notes and reminders on the calendar.' },
    offline: { title: 'On every device, even offline', text: 'Install it like an app on your phone and computer; what you write offline syncs when you reconnect.' },
  },
  privacyTitle: 'Your notes are yours',
  privacy: {
    p1: 'Your notes, files and session are stored in your own Google Drive and never reach our server.',
    p2: 'We only keep your email address, your name and your sign-in times.',
    p3: 'The source code is open for anyone to inspect on GitHub.',
    p4: 'Free.',
  },
  marketTitle: 'Extend it with plugins',
  marketLead: 'Install the features you want from the Market and remove the ones you don’t. Plugins you haven’t installed are never even loaded.',
  ctaTitle: 'All you need to start is a Google account.',
  terms: 'Terms of Use',
  privacyLink: 'Privacy',
  source: 'Source code',
  language: 'Language',
} satisfies Messages['landing'];
