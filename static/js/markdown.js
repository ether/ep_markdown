'use strict';

exports.postAceInit = (hook, context) => {
  const markdown = {
    enable: () => {
      // add css class markdown
      $('iframe[name="ace_outer"]').contents().find('iframe')
          .contents().find('#innerdocbody').addClass('markdown');
      $('#underline').hide(); // no markdown support for these
      $('#strikethrough').hide();
    },
    disable: () => {
      // add css class markdown
      $('iframe[name="ace_outer"]').contents().find('iframe')
          .contents().find('#innerdocbody').removeClass('markdown');
      $('#underline').removeAttr('style'); // no markdown support for these
      $('#strikethrough').removeAttr('style');
    },
  };

  /* init */
  if ($('#options-markdown').is(':checked')) {
    markdown.enable();
  } else {
    markdown.disable();
  }
  /* on click */
  $('#options-markdown').on('click', () => {
    if ($('#options-markdown').is(':checked')) {
      markdown.enable();
    } else {
      markdown.disable();
    }
  });
};

// inner pad CSS
exports.aceEditorCSS = (hookName, cb) => ['/ep_markdown/static/css/markdown.css'];
