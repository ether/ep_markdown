'use strict';

exports.postAceInit = (hookName, context) => {
  const enable = () => {
    // add css class markdown
    $('iframe[name="ace_outer"]').contents().find('iframe')
        .contents().find('#innerdocbody').addClass('markdown');
    $('#underline').hide(); // no markdown support for these
    $('#strikethrough').hide();
  };
  const disable = () => {
    // add css class markdown
    $('iframe[name="ace_outer"]').contents().find('iframe')
        .contents().find('#innerdocbody').removeClass('markdown');
    $('#underline').removeAttr('style'); // no markdown support for these
    $('#strikethrough').removeAttr('style');
  };

  /* init */
  if ($('#options-markdown').is(':checked')) {
    enable();
  } else {
    disable();
  }
  /* on click */
  $('#options-markdown').on('click', () => {
    if ($('#options-markdown').is(':checked')) {
      enable();
    } else {
      disable();
    }
  });
};

// inner pad CSS
exports.aceEditorCSS = (hookName, context) => ['/ep_markdown/static/css/markdown.css'];
