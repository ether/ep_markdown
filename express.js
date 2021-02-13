'use strict';

const exportMarkdown = require('./exportMarkdown');

exports.expressCreateServer = (hookName, args, cb) => {
  args.app.get('/p/:pad/:rev?/export/markdown', (req, res, next) => {
    const padID = req.params.pad;
    const revision = req.params.rev ? req.params.rev : null;

    exportMarkdown.getPadMarkdownDocument(padID, revision, (err, result) => {
      res.attachment(`${padID}.md`);
      res.contentType('plain/text');
      res.send(result);
    });
  });
  return cb();
};
