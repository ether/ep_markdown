var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");

exports.eejsBlock_exportColumn = function(hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_markdown/templates/exportcolumn.html", {}, module);
  return cb();
};

exports.eejsBlock_scripts = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_markdown/templates/scripts.html", {}, module);
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_markdown/templates/styles.html", {}, module);
  return cb();
};

