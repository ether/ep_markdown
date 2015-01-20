var eejs = require('ep_etherpad-lite/node/eejs/');
var Changeset = require("ep_etherpad-lite/static/js/Changeset");

function getInlineStyle(header) {
  switch (header) {
  case "h1":
    return "font-size: 2.0em;line-height: 120%;";
    break;
  case "h2":
    return "font-size: 1.5em;line-height: 120%;";
    break;
  case "h3":
    return "font-size: 1.17em;line-height: 120%;";
    break;
  case "h4":
    return "line-height: 120%;";
    break;
  case "h5":
    return "font-size: 0.83em;line-height: 120%;";
    break;
  case "h6":
    return "font-size: 0.75em;line-height: 120%;";
    break;
  case "code":
    return "font-family: monospace";
  }
  
  return "";
}
// line, apool,attribLine,text
exports.getLineHTMLForExport = function (hook, context) {
//  var header = _analyzeLine(context.attribLine, context.apool);
//  if (header) {
//    var inlineStyle = getInlineStyle(header);
//    return "<" + header + " style=\"" + inlineStyle + "\">" + context.text.substring(1) + "</" + header + ">";
//  }
}

function _analyzeLine(alineAttrs, apool) {
  var header = null;
  if (alineAttrs) {
    var opIter = Changeset.opIterator(alineAttrs);
    if (opIter.hasNext()) {
      var op = opIter.next();
      header = Changeset.opAttributeValue(op, 'heading', apool);
    }
  }
  return header;
}
