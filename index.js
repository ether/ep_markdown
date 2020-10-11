var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var settings = require('ep_etherpad-lite/node/utils/Settings');
var fs = require("fs");

exports.eejsBlock_exportColumn = function(hook_name, args, cb) {
  args.content = args.content + eejs.require('./templates/exportcolumn.html', {}, module);
  return cb();
};

exports.eejsBlock_scripts = function (hook_name, args, cb) {
  args.content = args.content + eejs.require('./templates/scripts.html', {}, module);
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require('./templates/styles.html', {}, module);
  return cb();
};

exports.eejsBlock_mySettings = function (hook_name, args, cb) {
  if (!settings.ep_markdown_default){
    checked_state = 'unchecked';
  }else{
    if(settings.ep_markdown_default == true){
      checked_state = 'checked';
    }
  }
  args.content = args.content +
      eejs.require('./templates/markdown_entry.ejs', {checked: checked_state}, module);
  return cb();
}

exports.import = function (hook_name, args ,callback){

  if(args.fileEnding.indexOf(".md") === -1) return callback();
  // It is Markdown file, let's go!

  var markdown  = fs.readFileSync(args.srcFile, 'utf-8');
  var showdown  = require('showdown');
  var converter = new showdown.Converter({completeHTMLDocument: true});

  var html      = converter.makeHtml(markdown);

  fs.writeFile(args.destFile, html, 'utf8', function(err){

    if(err) callback(err, null);
    callback(args.destFile);

  });

}
