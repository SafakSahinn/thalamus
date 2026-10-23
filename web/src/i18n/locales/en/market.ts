import type { Messages } from '../../types';

export default {
  title: 'Market',
  intro: 'Add new features to Thalamus. Plugins are not installed by default; install what you want and remove what you don’t.',
  all: 'All',
  installedCount: 'Installed ({count})',
  noneInstalled: 'No plugins installed yet.',
  screenshot: '{name} screenshot',
  install: 'Install',
  uninstall: 'Uninstall',
  installed: '✓ Installed',
  howTo: 'How to use:',
  requires: 'Requires the {names} plugin; it is installed along with this one.',
  dependents: 'Uninstalling also removes {names}, which depends on it.',
  uninstallKeeps: '“Uninstall” doesn’t delete its data, it only hides it; reinstall and you pick up where you left off.',
  purge: 'Uninstall and delete data',
  leftover: 'You have used this plugin before; its data ({data}) is still here and comes back if you reinstall.',
  purgeLeftover: 'Delete leftover data',
  confirmPurgeInstalled: '{name} will be uninstalled and {data} will be permanently deleted. This cannot be undone. Continue?',
  confirmPurge: '{name}: {data} will be permanently deleted. This cannot be undone. Continue?',
} satisfies Messages['market'];
