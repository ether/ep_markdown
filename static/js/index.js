'use strict';

var FountainParser = require('ep_fountain/static/js/fountainParser').FountainParser;

// Store the current line types for the document
var lineTypes = [];
var parseTimeout = null;
var aceContext = null;

/**
 * Get all lines from the Ace editor rep.
 */
function getAllLines(rep) {
  var lines = [];
  var totalLines = rep.lines.length();
  for (var i = 0; i < totalLines; i++) {
    var entry = rep.lines.atIndex(i);
    lines.push(entry.text || '');
  }
  return lines;
}

/**
 * Parse the full document and apply fountain-type attributes to each line.
 */
function parseAndApply(context) {
  if (!context || !context.editorInfo) return;

  var rep = context.editorInfo.ace_getRep();
  if (!rep || !rep.lines || rep.lines.length() === 0) return;

  var lines = getAllLines(rep);
  var newTypes = FountainParser.parse(lines);

  // Apply attributes only where type changed
  var documentAttributeManager = context.documentAttributeManager;
  if (!documentAttributeManager) return;

  for (var i = 0; i < newTypes.length; i++) {
    var newType = newTypes[i] || 'action';
    var oldType = lineTypes[i];

    if (newType !== oldType) {
      documentAttributeManager.setAttributeOnLine(i, 'fountain-type', newType);
    }
  }

  lineTypes = newTypes;
}

/**
 * Debounced parse: schedule a re-parse after a short delay.
 */
function scheduleParse(context) {
  if (parseTimeout) {
    clearTimeout(parseTimeout);
  }
  parseTimeout = setTimeout(function () {
    parseAndApply(context);
    parseTimeout = null;
  }, 100);
}

/**
 * aceInitialized — called once when the Ace editor is ready.
 * Perform initial parsing of the document.
 */
exports.aceInitialized = function (hookName, context) {
  aceContext = context;
  // Delay initial parse to ensure the document is loaded
  setTimeout(function () {
    parseAndApply(context);
  }, 500);
};

/**
 * aceEditorCSS — inject our Fountain stylesheet into the Ace iframe.
 */
exports.aceEditorCSS = function () {
  return ['/ep_fountain/static/css/fountain.css'];
};

/**
 * aceAttribsToClasses — convert fountain-type attributes to CSS classes.
 * Called by Etherpad for each line attribute.
 */
exports.aceAttribsToClasses = function (hookName, context) {
  if (context.key === 'fountain-type') {
    return ['fountain-' + context.value];
  }
  return [];
};

/**
 * aceDomLineProcessLineAttributes — wrap lines in appropriate HTML elements.
 * This is how ep_headings2 applies heading tags; we use divs with classes.
 */
exports.aceDomLineProcessLineAttributes = function (hookName, context) {
  var cls = context.cls;
  if (!cls) return;

  // Find fountain-* class in the class string
  var match = cls.match(/fountain-([a-z_0-9]+)/);
  if (!match) return;

  var fountainType = match[1];

  // Map fountain types to HTML wrapper elements
  var tagMap = {
    'scene_heading': 'div',
    'character': 'div',
    'dialogue': 'div',
    'parenthetical': 'div',
    'transition': 'div',
    'action': 'div',
    'centered': 'div',
    'section_h1': 'div',
    'section_h2': 'div',
    'section_h3': 'div',
    'section_h4': 'div',
    'section_h5': 'div',
    'section_h6': 'div',
    'synopsis': 'div',
    'note': 'div',
    'lyrics': 'div',
    'page_break': 'div'
  };

  var tag = tagMap[fountainType];
  if (!tag) return;

  return [{
    preHtml: '<' + tag + ' class="fountain-' + fountainType + '">',
    postHtml: '</' + tag + '>',
    processedMarker: true
  }];
};

/**
 * aceRegisterBlockElements — register our custom block elements so Etherpad
 * treats them properly for line handling.
 */
exports.aceRegisterBlockElements = function () {
  return ['div'];
};

/**
 * acePostWriteDomLineHTML — after a line is rendered, schedule a re-parse
 * because the content may have changed and context-dependent types may shift.
 */
exports.acePostWriteDomLineHTML = function (hookName, context) {
  if (aceContext) {
    scheduleParse(aceContext);
  }
};
