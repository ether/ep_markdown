'use strict';

const exportMarkdown = require('./exportMarkdown');

exports.expressCreateServer = (hookName, {app}) => {
  app.get('/p/:padId/export/markdown', async (req: any, res: any, next: any) => {
    try {
      const {padId} = req.params;
      res.attachment(`${padId}.md`);
      res.contentType('plain/text');
      res.send(await exportMarkdown.getPadMarkdownDocument(padId));
    } catch (err) {
      next(err || new Error(err));
    }
  });

  app.get('/p/:padId/:revNum/export/markdown', async (req: any, res: any, next: any) => {
    try {
      const {padId, revNum} = req.params;
      res.attachment(`${padId}.md`);
      res.contentType('plain/text');
      res.send(await exportMarkdown.getPadMarkdownDocument(padId, revNum));
    } catch (err) {
      next(err || new Error(err));
    }
  });
};
