import type { Messages } from '../../types';

export default {
  wiki: {
    newOf: 'New {label}: “{title}”',
    gone: 'This note was deleted or hasn’t synced yet',
    keepTyping: 'Keep typing…',
  },
  button: {
    todayToken: '{today}',
    fallback: 'Button',
    configure: 'Configure button',
    labelField: 'Button text',
    insert: 'Insert content',
    note: 'Open a new record',
    insertHint: 'Each press inserts the content below under the button. {token} becomes that day’s date.',
    placeholder: 'Content to insert… e.g. ## Meeting {token}',
    collection: 'Collection',
  },
  dict: {
    title: '🔤 Dictionary',
    review: '🧠 Review',
    intro: 'Every word you add in books, papers and movies is collected here. If a word appears in several sources, they all show next to it and are linked on the map.',
    word: 'Word',
    meaning: 'Meaning',
    exists: '“{title}” is already in the dictionary: {link}',
    open: 'open',
    search: 'Search words or meanings…',
    allLangs: 'All languages',
    all: 'All',
    toLearn: 'To learn',
    learned: 'Learned',
    learnedTitle: 'Learned',
    meaningPlaceholder: 'meaning…',
  },
} satisfies Messages['blocks'];
