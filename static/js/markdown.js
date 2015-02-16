if(typeof exports == 'undefined'){
  var exports = this['mymodule'] = {};
}

exports.postAceInit = function(hook, context){
  var markdown = {
    enable: function() {
      $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").addClass("markdown"); // add css class markdown
      $('#underline').hide(); // no markdown support for these
      $('#strikethrough').hide();
    },
    disable: function() {
      $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").removeClass("markdown"); // add css class markdown
      $('#underline').removeAttr('style'); // no markdown support for these
      $('#strikethrough').removeAttr('style');
    }
  }

  /* init */
  if($('#options-markdown').is(':checked')) {
    markdown.enable();
  } else {
    markdown.disable();
  }
  /* on click */
  $('#options-markdown').on('click', function() {
    if($('#options-markdown').is(':checked')) {
      markdown.enable();
    } else {
      markdown.disable();
    }
  });
}

exports.aceEditorCSS = function(hook_name, cb){
  return ["/ep_markdown/static/css/markdown.css"];
} // inner pad CSS
