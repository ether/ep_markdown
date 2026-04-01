'use strict';

const eejs = require('ep_etherpad-lite/node/eejs');
import settings from 'ep_etherpad-lite/node/utils/Settings';
import {promises} from 'fs';
const fsp = promises

exports.eejsBlock_exportColumn = (hookName, context) => {
  context.content += eejs.require('./templates/exportcolumn.html', {}, module);
};

exports.eejsBlock_styles = (hookName, context) => {
  context.content += eejs.require('./templates/styles.html', {}, module);
};

exports.eejsBlock_mySettings = (hookName, context) => {
  let checkedState = 'unchecked';
  if (!settings.ep_markdown_default) {
    checkedState = 'unchecked';
  } else if (settings.ep_markdown_default === true) {
    checkedState = 'checked';
  }
  context.content +=
      eejs.require('./templates/markdown_entry.ejs', {checked: checkedState}, module);
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
