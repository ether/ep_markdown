'use strict';

$(document).ready(() => {
  const padRootPath = new RegExp(/.*\/p\/[^/]+/)
      .exec(document.location.pathname) || clientVars.padId;
  $('#exportmarkdowna').attr('href', `${padRootPath}/export/markdown`);
});
