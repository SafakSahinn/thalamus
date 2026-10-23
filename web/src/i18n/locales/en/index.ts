import type { Messages } from '../../types';
import app from './app';
import blocks from './blocks';
import calendar from './calendar';
import capture from './capture';
import coll from './coll';
import collPage from './collPage';
import common from './common';
import dialogs from './dialogs';
import editor from './editor';
import home from './home';
import importer from './importer';
import keys from './keys';
import market from './market';
import misc from './misc';
import note from './note';
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
import slash from './slash';
import study from './study';
import time from './time';
import tpl from './tpl';
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
  editor,
  home,
  importer,
  keys,
  market,
  misc,
  note,
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
  slash,
  study,
  time,
  tpl,
  types,
  views,
  writing,
} satisfies Messages;
