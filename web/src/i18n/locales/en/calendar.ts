import type { Messages } from '../../types';

export default {
  sync: {
    title: 'Google Calendar sync',
    intro: 'The date fields you choose become events in a separate calendar called {cal} in your Google Calendar. Sync works both ways: change a date in Thalamus and the event moves; delete the note or the date and the event is deleted too. Move an event in Google Calendar and the date in the note changes; delete it and that date field is cleared. If you changed the same date on both sides, Thalamus wins. Events you add to this calendar by hand are left alone. Thalamus can access only this calendar and can’t see your others.',
    done: 'Calendar synced: {created} new, {updated} updated, {deleted} deleted events.',
    donePulled: 'Calendar synced: {created} new, {updated} updated, {deleted} deleted events; {pulled} changes from the calendar applied to notes.',
    connecting: 'Connecting…',
    opening: 'Turning on…',
    enable: 'Turn on sync',
    connect: '📅 Connect Google Calendar',
    permission: 'Google only asks for permission to manage the calendar this app creates.',
    on: '● On',
    lastSync: 'last synced {time}',
    syncing: 'Syncing…',
    syncNow: 'Sync now',
    which: 'Which dates should go to the calendar?',
    reminder: 'Reminder (09:00 in the morning)',
    sameDay: 'On the day',
    oneWeek: '1 week before',
    twoWeeks: '2 weeks before',
    daysBefore: { one: '{count} day before', other: '{count} days before' },
    stop: 'Stop syncing',
    confirmDelete: 'Delete the “Thalamus” calendar in Google Calendar and all its events? Your notes are not affected.',
    deleting: 'Deleting…',
    delete: 'Delete the Thalamus calendar',
  },
} satisfies Messages['calendar'];
