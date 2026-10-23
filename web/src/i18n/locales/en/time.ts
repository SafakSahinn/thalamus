import type { Messages } from '../../types';

export default {
  justNow: 'just now',
  minAgo: '{count} min ago',
  hourAgo: '{count} h ago',
  dayAgo: { one: '{count} day ago', other: '{count} days ago' },
} satisfies Messages['time'];
