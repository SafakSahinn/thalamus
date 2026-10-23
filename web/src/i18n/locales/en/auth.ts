import type { Messages } from '../../types';

export default {
  loadFailed: 'Could not load the Google connection. Check your internet connection.',
  sessionNote: 'Thalamus session key (encrypted). If you delete it, Google permission will be asked again on new devices.',
  errors: {
    popup_closed: 'The Google window was closed.',
    drive_scope_missing: 'To store your notes you also need to approve the Google Drive permission.',
    calendar_scope_missing: 'Calendar sync needs the Google Calendar permission.',
    need_consent: 'To continue on this device you need to approve the Google permission once.',
    access_denied: 'Google permission was not granted.',
  },
  noOffline: 'Google didn’t grant lasting permission, please try again.',
  noSession: 'No session',
  revoked: 'Google permission was revoked',
  expired: 'Your Google session has expired, please sign in again.',
  sharedFile: 'Shared - {title}.json',
  sharedFallback: 'note',
  localOnly: 'This file is only on the device it was uploaded from.',
} satisfies Messages['auth'];
