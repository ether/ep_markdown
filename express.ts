'use strict';

const exportMarkdown = require('./exportMarkdown');

// Mirrors the Access-Control-Allow-Origin header that Etherpad core sets on
// its native /export/* routes (see etherpad-lite's
// src/node/hooks/express/importexport.ts). Without this, browsers block
// repeated fetches of /p/:padId/export/markdown with a CORS error — which
// integrators hit when rate-limited exports get retried or when the export
// is initiated from a different origin (issue #139).
const addCorsHeader = (res: any) => {
  res.header('Access-Control-Allow-Origin', '*');
};

exports.expressCreateServer = (hookName, {app}) => {
  app.get('/p/:padId/export/markdown', async (req: any, res: any, next: any) => {
    try {
      const {padId} = req.params;
      addCorsHeader(res);
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
      addCorsHeader(res);
      res.attachment(`${padId}.md`);
      res.contentType('plain/text');
      res.send(await exportMarkdown.getPadMarkdownDocument(padId, revNum));
    } catch (err) {
      next(err || new Error(err));
    }
  });
};
