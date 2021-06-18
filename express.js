'use strict';

const exportMarkdown = require('./exportMarkdown');

exports.expressCreateServer = (hookName, {app}) => {
  app.get('/p/:padId/:revNum?/export/markdown', (req, res, next) => {
    (async () => {
      const {padId, revNum} = req.params;
      res.attachment(`${padId}.md`);
      res.contentType('plain/text');
      res.send(await exportMarkdown.getPadMarkdownDocument(padId, revNum));
    })().catch((err) => next(err || new Error(err)));
  });
};
