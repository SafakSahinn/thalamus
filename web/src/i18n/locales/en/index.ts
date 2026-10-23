import type { Messages } from '../../types';
import app from './app';
import common from './common';
import market from './market';
import plugins from './plugins';
import settings from './settings';
import sidebar from './sidebar';
import time from './time';

export default {
  app,
  common,
  market,
  plugins,
  settings,
  sidebar,
  time,
} satisfies Messages;
