import type { Messages } from '../../types';

export default {
  newOf: 'New {type}: “{q}”',
  daily: 'Today’s journal',
  graph: 'Connection map',
  dict: 'Dictionary',
  market: 'Plugin market',
  sticky: 'New sticky note',
  placeholder: 'Search notes or create a new one…',
  foot: '↑↓ select · Enter open · Esc close · Ctrl+K opens from anywhere',
} satisfies Messages['palette'];
