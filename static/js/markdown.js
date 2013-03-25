if(typeof exports == 'undefined'){
  var exports = this['mymodule'] = {};
}

exports.postAceInit = function(hook, context){
  $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").addClass("markdown");
  $('#underline').hide(); // no markdown support for these
  $('#strikethrough').hide(); 
}

exports.aceEditorCSS = function(hook_name, cb){return ["/ep_markdown/static/css/markdown.css"];} // inner pad CSS

