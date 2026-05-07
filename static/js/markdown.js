'use strict';

// Sub-path import keeps the client bundle clean. Importing the top-level
// `ep_plugin_helpers` index pulls in every helper's getters; `settings` and
// `toggle` reach server-only modules (eejs, Settings) which esbuild can't
// resolve for the browser.
const {padToggle} = require('ep_plugin_helpers/pad-toggle');

// Same config as the server-side instance — must agree on pluginName,
// settingId, l10nId, and defaultLabel for the checkbox ids and clientVars
// lookup to line up.
const markdownToggle = padToggle({
  pluginName: 'ep_markdown',
  settingId: 'markdown',
  l10nId: 'ep_markdown.showMarkdown',
  defaultLabel: 'Show Markdown',
  defaultEnabled: false,
});

// Re-export so the helper sees pad-wide broadcasts and refreshes our state
// when another user toggles the pad-wide checkbox.
exports.handleClientMessage_CLIENT_MESSAGE = markdownToggle.handleClientMessage_CLIENT_MESSAGE;

exports.postAceInit = (hookName, context) => {
  const padRootPath = new RegExp(/.*\/p\/[^/]+/)
      .exec(document.location.pathname) || clientVars.padId;
  $('#exportmarkdowna').attr('href', `${padRootPath}/export/markdown`);

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

  markdownToggle.init({
    onChange: (enabled) => { enabled ? enable() : disable(); },
  });
};

// inner pad CSS
exports.aceEditorCSS = (hookName, context) => ['/ep_markdown/static/css/markdown.css'];
