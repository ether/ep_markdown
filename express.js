'use strict';

const exportMarkdown = require('./exportMarkdown');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const rateLimit = require('express-rate-limit');

exports.expressCreateServer = (hookName, {app}) => {
  const limiter = rateLimit({
    ...settings.importExportRateLimiting,
    handler: (request) => {
      if (request.rateLimit.current === request.rateLimit.limit + 1) {
        // when the rate limiter triggers, write a warning in the logs
        console.warn('Import/Export rate limiter triggered on ' +
            `"${request.originalUrl}" for IP address ${request.ip}`);
      }
    },
  });
  
  app.use('/p/:padId/:revNum?/export/markdown', limiter);
  app.get('/p/:padId/:revNum?/export/markdown', (req, res, next) => {
    (async () => {
      const {padId, revNum} = req.params;
      res.attachment(`${padId}.md`);
      res.header('Access-Control-Allow-Origin', '*');
      res.contentType('plain/text');
      res.send(await exportMarkdown.getPadMarkdownDocument(padId, revNum));
    })().catch((err) => next(err || new Error(err)));
  });
};
