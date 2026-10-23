import type { Messages } from '../../types';
import app from './app';
import blocks from './blocks';
import calendar from './calendar';
import capture from './capture';
import coll from './coll';
import collPage from './collPage';
import common from './common';
import dialogs from './dialogs';
import importer from './importer';
import market from './market';
import misc from './misc';
import options from './options';
import pages from './pages';
import palette from './palette';
import panels from './panels';
import papers from './papers';
import plugins from './plugins';
import props from './props';
import reading from './reading';
import schema from './schema';
import settings from './settings';
import sidebar from './sidebar';
import study from './study';
import time from './time';
import types from './types';
import views from './views';
import writing from './writing';

export default {
  app,
  blocks,
  calendar,
  capture,
  coll,
  collPage,
  common,
  dialogs,
  importer,
  market,
  misc,
  options,
  pages,
  palette,
  panels,
  papers,
  plugins,
  props,
  reading,
  schema,
  settings,
  sidebar,
  study,
  time,
  types,
  views,
  writing,
} satisfies Messages;
