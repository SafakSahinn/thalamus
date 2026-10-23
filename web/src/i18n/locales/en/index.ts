import type { Messages } from '../../types';
import app from './app';
import calendar from './calendar';
import capture from './capture';
import coll from './coll';
import common from './common';
import dialogs from './dialogs';
import market from './market';
import misc from './misc';
import options from './options';
import pages from './pages';
import palette from './palette';
import panels from './panels';
import plugins from './plugins';
import props from './props';
import schema from './schema';
import settings from './settings';
import sidebar from './sidebar';
import time from './time';
import types from './types';
import views from './views';
import writing from './writing';

export default {
  app,
  calendar,
  capture,
  coll,
  common,
  dialogs,
  market,
  misc,
  options,
  pages,
  palette,
  panels,
  plugins,
  props,
  schema,
  settings,
  sidebar,
  time,
  types,
  views,
  writing,
} satisfies Messages;
