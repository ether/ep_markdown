var exportMarkdown = require('./exportMarkdown');

exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.get('/p/:pad/:rev?/export/markdown', function(req, res, next) {
    var padID = req.params.pad;
    var revision = req.params.rev ? req.params.rev : null;

    exportMarkdown.getPadMarkdownDocument(padID, revision, function(err, result) {
      try {
          res.setHeader('Content-disposition', 'attachment; filename='+padID+'.md');
      }
      catch(err) {
          res.setHeader('Content-disposition', 'attachment; filename=pad.md');
          console.warning('Bad char in padID : ' + padID);
      }
      res.contentType('plain/text');
      res.send(result);
    });
  });
};
