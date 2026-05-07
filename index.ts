'use strict';

const eejs = require('ep_etherpad-lite/node/eejs');
const {padToggle} = require('ep_plugin_helpers/pad-toggle-server');
import {promises} from 'fs';
const fsp = promises

// Parallel User Settings + Pad Wide Settings checkboxes for "Show Markdown".
// Helper owns storage, broadcast, enforce, and i18n wiring.
const markdownToggle = padToggle({
  pluginName: 'ep_markdown',
  settingId: 'markdown',
  l10nId: 'ep_markdown.showMarkdown',
  defaultLabel: 'Show Markdown',
  defaultEnabled: false,
});

exports.loadSettings = markdownToggle.loadSettings;
exports.clientVars = markdownToggle.clientVars;
exports.eejsBlock_mySettings = markdownToggle.eejsBlock_mySettings;
exports.eejsBlock_padSettings = markdownToggle.eejsBlock_padSettings;

exports.eejsBlock_exportColumn = (hookName, context) => {
  context.content += eejs.require('./templates/exportcolumn.html', {}, module);
};

exports.eejsBlock_styles = (hookName, context) => {
  context.content += eejs.require('./templates/styles.html', {}, module);
};

exports.import = async (hookName, {destFile, fileEnding, srcFile}) => {
  if (fileEnding !== '.md') return;

  const markdown = await fsp.readFile(srcFile, 'utf8');
  const showdown = require('showdown');
  const converter = new showdown.Converter({completeHTMLDocument: true});

  const html = converter.makeHtml(markdown);

  await fsp.writeFile(destFile, html, 'utf8');
  return destFile;
};
