'use strict';

const eejs = require('ep_etherpad-lite/node/eejs');

exports.eejsBlock_editbarMenuRight = (hookName, context) => {
  context.content += eejs.require('./templates/editbarButtons.ejs', {}, module);
};

exports.eejsBlock_styles = (hookName, context) => {
  context.content += '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap">';
};

exports.expressCreateServer = (hookName, {app}) => {
  app.get('/p/:padId/:revNum?/export/fountain', (req, res, next) => {
    (async () => {
      const padManager = require('ep_etherpad-lite/node/db/PadManager');
      const {padId, revNum} = req.params;
      const pad = await padManager.getPad(padId);
      const text = pad.atext.text;
      res.attachment(`${padId}.fountain`);
      res.contentType('text/plain');
      res.send(text);
    })().catch((err) => next(err || new Error(err)));
  });
};
