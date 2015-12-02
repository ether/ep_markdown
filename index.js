var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var settings = require('ep_etherpad-lite/node/utils/Settings');

/* Add GUI entries to export as markdown file */
exports.eejsBlock_exportColumn = function(hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_markdown/templates/exportcolumn.html", {}, module);
  return cb();
};

/* Add static client scripts */
exports.eejsBlock_scripts = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_markdown/templates/scripts.html", {}, module);
  return cb();
};

/* Add static client CSS */
exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_markdown/templates/styles.html", {}, module);
  return cb();
};

/* Add GUI button to toggle show markdown / show formatted text */
exports.eejsBlock_mySettings = function (hook_name, args, cb) {
  if (!settings.ep_markdown_default){
    checked_state = 'unchecked';
  }else{
    if(settings.ep_markdown_default == true){
      checked_state = 'checked';
    }
  }
  args.content = args.content + eejs.require('ep_markdown/templates/markdown_entry.ejs', {checked : checked_state});
  return cb();
}

