'use strict';

const eejs = require('ep_etherpad-lite/node/eejs');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const fs = require('fs');

exports.eejsBlock_exportColumn = (hookName, args, cb) => {
  args.content += eejs.require('./templates/exportcolumn.html', {}, module);
  return cb();
};

exports.eejsBlock_scripts = (hookName, args, cb) => {
  args.content += eejs.require('./templates/scripts.html', {}, module);
  return cb();
};

exports.eejsBlock_styles = (hookName, args, cb) => {
  args.content += eejs.require('./templates/styles.html', {}, module);
  return cb();
};

exports.eejsBlock_mySettings = (hookName, args, cb) => {
  let checkedState = 'unchecked';
  if (!settings.ep_markdown_default) {
    checkedState = 'unchecked';
  } else if (settings.ep_markdown_default === true) {
    checkedState = 'checked';
  }
  args.content +=
      eejs.require('./templates/markdown_entry.ejs', {checked: checkedState}, module);
  return cb();
};

exports.import = (hookName, args, callback) => {
  if (args.fileEnding.indexOf('.md') === -1) return callback();
  // It is Markdown file, let's go!

  const markdown = fs.readFileSync(args.srcFile, 'utf-8');
  const showdown = require('showdown');
  const converter = new showdown.Converter({completeHTMLDocument: true});

  const html = converter.makeHtml(markdown);

  fs.writeFile(args.destFile, html, 'utf8', (err) => {
    if (err) callback(err, null);
    callback(args.destFile);
  });
};
