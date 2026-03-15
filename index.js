'use strict';

const eejs = require('ep_etherpad-lite/node/eejs');

exports.eejsBlock_editbarMenuRight = (hookName, context) => {
  context.content += eejs.require('./templates/editbarButtons.ejs', {}, module);
};

exports.eejsBlock_styles = (hookName, context) => {
  context.content +=
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap" />\n';
};
