var exportMarkdown = require('./exportMarkdown');

exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.get('/p/:pad/:rev?/export/markdown', function(req, res, next) {
    var padID = req.params.pad;
    var revision = req.params.rev ? req.params.rev : null;

    exportMarkdown.getPadMarkdownDocument(padID, revision, function(err, result) {
      res.setHeader('Content-disposition', 'attachment; filename='+padID+'.md');
      res.contentType('plain/text');
      res.header('Access-Control-Allow-Origin', '*');
      res.send(result);
    });
  });
};

