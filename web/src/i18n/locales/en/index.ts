import type { Messages } from '../../types';
import app from './app';
import common from './common';
import market from './market';
import misc from './misc';
import options from './options';
import pages from './pages';
import panels from './panels';
import plugins from './plugins';
import settings from './settings';
import sidebar from './sidebar';
import time from './time';
import types from './types';

export default {
  app,
  common,
  market,
  misc,
  options,
  pages,
  panels,
  plugins,
  settings,
  sidebar,
  time,
  types,
} satisfies Messages;
