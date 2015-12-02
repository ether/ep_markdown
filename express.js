var exportMarkdown = require('./exportMarkdown');

/* Add URL /export/markdown and associated handler */
exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.get('/p/:pad/:rev?/export/markdown', function(req, res, next) {
    var padID = req.params.pad;
    var revision = req.params.rev ? req.params.rev : null;

    exportMarkdown.getPadMarkdownDocument(padID, revision, function(err, result) {
      res.contentType('plain/text');
      res.send(result);
    });
  });
};

