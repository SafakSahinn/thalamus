import type { Messages } from '../../types';

export default {
  error: {
    title: 'Something went wrong',
    body: 'An error occurred while showing this page. Your notes are safe; reloading the page usually fixes it.',
    reload: 'Reload page',
    home: 'Back to home',
  },
  clipper: {
    title: 'Save from your computer',
    body: 'Drag the button below to your browser’s {drag} (press Ctrl+Shift+B if it’s hidden). Click it on a page you’re reading and the page’s title and address — plus any text you’ve selected — come to Thalamus; pick a collection and save.',
    drag: 'bookmarks bar',
    dragTitle: 'Drag to the bookmarks bar',
    button: '📥 Save to Thalamus',
  },
  noResults: 'No results',
  interval: {
    days: { one: '{count} day', other: '{count} days' },
    months: { one: '{count} month', other: '{count} months' },
    years: '{count} years',
  },
  minutes: '{count} min',
  hours: '{count} h',
  hoursMinutes: '{h} h {m} min',
  pomo: {
    title: '🍅 Pomodoro done',
    body: '{title}: {count} minutes done. Take a short break.',
    study: 'Study',
  },
} satisfies Messages['misc'];
