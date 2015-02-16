$(document).ready(function (){
  var pad_root_path = new RegExp(/.*\/p\/[^\/]+/).exec(document.location.pathname) || clientVars.padId;
  var pad_root_url = document.location.href.replace(document.location.pathname, pad_root_path)
  $("#exportmarkdowna").attr("href", pad_root_path + "/export/markdown");
});
