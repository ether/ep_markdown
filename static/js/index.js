'use strict';

const FOUNTAIN_ATTR = 'fountain-type';

// All valid fountain types for aceAttribsToClasses
const FOUNTAIN_TYPES = [
  'scene_heading', 'character', 'dialogue', 'parenthetical',
  'transition', 'action', 'centered', 'section_h1', 'section_h2',
  'section_h3', 'section_h4', 'section_h5', 'section_h6',
  'synopsis', 'note', 'lyrics', 'page_break',
  'title_key', 'title_value', 'boneyard',
];

let padInner = null;
let documentAttributeManager = null;
let parseTimeout = null;

/**
 * Get all lines of text from the pad's inner document.
 */
const getPadLines = () => {
  if (!padInner) return [];
  const doc = padInner.contents();
  const lines = [];
  doc.find('div').each(function () {
    lines.push($(this).text());
  });
  return lines;
};

/**
 * Run the Fountain parser on the full document and apply line attributes.
 */
const applyFountainAttributes = () => {
  if (!documentAttributeManager || !padInner) return;

  const lines = getPadLines();
  if (lines.length === 0) return;

  // Use the parser (loaded via aceEditorCSS / require)
  const types = window.FountainParser
    ? window.FountainParser.parseLines(lines)
    : [];

  if (types.length === 0) return;

  for (let i = 0; i < types.length; i++) {
    const newType = types[i] || 'action';
    try {
      documentAttributeManager.setAttributeOnLine(i, FOUNTAIN_ATTR, newType);
    } catch (e) {
      // Line may not exist yet during rapid edits
    }
  }
};

/**
 * Debounced re-parse: wait for typing to pause before re-parsing.
 */
const scheduleReparse = () => {
  if (parseTimeout) clearTimeout(parseTimeout);
  parseTimeout = setTimeout(() => {
    applyFountainAttributes();
  }, 150);
};

// ===================== ETHERPAD HOOKS =====================

/**
 * postAceInit — called after the Ace editor is fully initialized.
 * We store references and run the initial parse.
 */
exports.postAceInit = (hookName, context) => {
  padInner = $('iframe[name="ace_outer"]').contents().find('iframe[name="ace_inner"]');
  // Initial parse after a short delay to let the content load
  setTimeout(() => {
    applyFountainAttributes();
  }, 500);
};

/**
 * aceInitialized — store the editorInfo for later use.
 */
exports.aceInitialized = (hookName, context) => {
  documentAttributeManager = context.documentAttributeManager;
  padInner = context.editorInfo
    ? null  // Will be set in postAceInit
    : null;
};

/**
 * aceEditEvent — called on every edit.
 * We schedule a debounced re-parse of the entire document.
 */
exports.aceEditEvent = (hookName, context) => {
  if (!context.callstack.editEvent.eventType &&
      !context.callstack.editEvent.eventType === 'setup') return;

  // On any text change, re-parse
  if (context.callstack.type === 'handleKeyEvent' ||
      context.callstack.type === 'handleClick' ||
      context.callstack.docTextChanged) {
    scheduleReparse();
  }
};

/**
 * aceAttribsToClasses — convert fountain-type attributes to CSS classes.
 * Called by Ace for each span to determine its CSS classes.
 */
exports.aceAttribsToClasses = (hookName, context) => {
  if (context.key === FOUNTAIN_ATTR && context.value) {
    return ['fountain-' + context.value];
  }
  return [];
};

/**
 * aceDomLineProcessLineAttributes — apply line-level formatting.
 * This adds a CSS class to the line's DOM element based on its fountain-type.
 */
exports.aceDomLineProcessLineAttributes = (hookName, context) => {
  const lineType = context.cls && context.cls.match(/fountain-([a-z_0-9]+)/);
  if (!lineType) return [];

  const type = lineType[1];
  if (FOUNTAIN_TYPES.indexOf(type) === -1) return [];

  const modifier = {
    preHtml: '<div class="fountain-line fountain-' + type + '">',
    postHtml: '</div>',
    processedMarker: true,
  };
  return [modifier];
};

/**
 * aceRegisterBlockElements — register our custom block element tag.
 */
exports.aceRegisterBlockElements = (hookName, context) => {
  return ['div'];
};

/**
 * aceEditorCSS — inject our stylesheet and the parser script into the Ace iframe.
 */
exports.aceEditorCSS = (hookName, context) => {
  return [
    '/ep_fountain/static/css/fountain.css',
    '/ep_fountain/static/js/fountainParser.js',
  ];
};

/**
 * collectContentLineText — ensure Fountain text is preserved as-is.
 * We don't modify the text content at all.
 */
exports.collectContentLineText = (hookName, context) => {
  // No transformation needed — Fountain is plain text
  return [];
};
