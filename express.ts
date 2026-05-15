'use strict';

const exportMarkdown = require('./exportMarkdown');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const rateLimit = require('express-rate-limit');

// Mirrors the rate limiting, CORS header, and readonly-pad handling that
// Etherpad core applies to its native /p/:pad/export/:type routes
// (src/node/hooks/express/importexport.ts). Without these, integrators hit
// browser CORS errors on repeated fetches (issue #139) and the readonly
// `r.*` pad IDs fail because markdown's export path did not resolve them
// to their underlying pad IDs.

exports.expressCreateServer = (hookName, {app}) => {
  const limiter = rateLimit({
    ...settings.importExportRateLimiting,
    handler: (request: any) => {
      if (request.rateLimit.current === request.rateLimit.limit + 1) {
        console.warn('Import/Export rate limiter triggered on ' +
            `"${request.originalUrl}" for IP address ${request.ip}`);
      }
    },
  });

  // Apply the core rate limiter to both with-revision and without-revision
  // markdown export endpoints, matching the pattern used by Etherpad core.
  app.use('/p/:padId/export/markdown', limiter);
  app.use('/p/:padId/:revNum/export/markdown', limiter);

  app.get('/p/:padId/export/markdown', async (req: any, res: any, next: any) => {
    try {
      const {padId} = req.params;
      res.header('Access-Control-Allow-Origin', '*');
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
      res.header('Access-Control-Allow-Origin', '*');
      res.attachment(`${padId}.md`);
      res.contentType('plain/text');
      res.send(await exportMarkdown.getPadMarkdownDocument(padId, revNum));
    } catch (err) {
      next(err || new Error(err));
    }
  });
};
