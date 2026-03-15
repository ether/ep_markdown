'use strict';

/**
 * Line-by-line Fountain parser for real-time collaborative editing.
 *
 * Fountain is context-sensitive: a line in UPPERCASE is only a character name
 * if preceded by an empty line and followed by dialogue. We parse the full
 * document each time but do it efficiently with simple string checks.
 *
 * Returns an array of { lineNumber, type } objects.
 */

var FountainParser = (function () {
  // Scene heading prefixes (case-insensitive check done after uppercase)
  var SCENE_HEADING_PREFIXES = [
    'INT ', 'INT.', 'EXT ', 'EXT.', 'EST ', 'EST.',
    'INT/EXT ', 'INT/EXT.', 'INT./EXT ', 'INT./EXT.',
    'I/E ', 'I/E.'
  ];

  var TRANSITION_SUFFIXES = ['TO:'];
  var TRANSITION_WORDS = [
    'FADE OUT.', 'FADE TO BLACK.', 'CUT TO BLACK.'
  ];

  function isBlank(line) {
    return line === undefined || line.trim() === '';
  }

  function isSceneHeading(line) {
    if (!line || line.trim() === '') return false;
    var trimmed = line.trim();

    // Forced scene heading: starts with .
    // But NOT ".." (which is just a line starting with two dots)
    if (trimmed.charAt(0) === '.' && trimmed.charAt(1) !== '.') {
      return true;
    }

    var upper = trimmed.toUpperCase();
    for (var i = 0; i < SCENE_HEADING_PREFIXES.length; i++) {
      if (upper.indexOf(SCENE_HEADING_PREFIXES[i]) === 0) {
        return true;
      }
    }
    return false;
  }

  function isTransition(line, prevLine, nextLine) {
    if (!line || line.trim() === '') return false;
    var trimmed = line.trim();

    // Forced transition: starts with >
    // But NOT centered text (starts with > and ends with <)
    if (trimmed.charAt(0) === '>' && trimmed.charAt(trimmed.length - 1) !== '<') {
      return true;
    }

    // Must be uppercase, end with TO: or be a known transition, and surrounded by blank lines
    if (!isBlank(prevLine) || !isBlank(nextLine)) return false;

    var upper = trimmed.toUpperCase();
    if (upper !== trimmed) return false; // must be all uppercase

    for (var i = 0; i < TRANSITION_SUFFIXES.length; i++) {
      if (upper.slice(-TRANSITION_SUFFIXES[i].length) === TRANSITION_SUFFIXES[i]) {
        return true;
      }
    }
    for (var j = 0; j < TRANSITION_WORDS.length; j++) {
      if (upper === TRANSITION_WORDS[j]) {
        return true;
      }
    }
    return false;
  }

  function isCentered(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.length >= 2 &&
           trimmed.charAt(0) === '>' &&
           trimmed.charAt(trimmed.length - 1) === '<';
  }

  function isPageBreak(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.length >= 3 && /^={3,}$/.test(trimmed);
  }

  function isSection(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.charAt(0) === '#';
  }

  function getSectionDepth(line) {
    var trimmed = line.trim();
    var depth = 0;
    while (depth < trimmed.length && trimmed.charAt(depth) === '#') {
      depth++;
    }
    return Math.min(depth, 6);
  }

  function isSynopsis(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.charAt(0) === '=' && trimmed.charAt(1) !== '=';
  }

  function isNote(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.indexOf('[[') === 0 && trimmed.indexOf(']]') !== -1;
  }

  function isLyrics(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.charAt(0) === '~';
  }

  function isCharacter(line, prevLine, nextLine) {
    if (!line || line.trim() === '') return false;
    var trimmed = line.trim();

    // Must be preceded by a blank line
    if (!isBlank(prevLine)) return false;

    // Must be followed by non-blank (dialogue or parenthetical)
    if (isBlank(nextLine)) return false;

    // Forced character: starts with @
    if (trimmed.charAt(0) === '@') return true;

    // Must be uppercase (letters only - ignore numbers, parens for V.O., etc.)
    var letters = trimmed.replace(/[^A-Za-z]/g, '');
    if (letters.length === 0) return false;
    if (letters !== letters.toUpperCase()) return false;

    // Cannot be a scene heading or transition
    if (isSceneHeading(line)) return false;

    // Handle character extensions like (V.O.), (O.S.), (CONT'D)
    // and dual dialogue marker ^
    return true;
  }

  function isParenthetical(line) {
    if (!line) return false;
    var trimmed = line.trim();
    return trimmed.charAt(0) === '(' && trimmed.charAt(trimmed.length - 1) === ')';
  }

  /**
   * Parse all lines and return an array of line types.
   * @param {string[]} lines - Array of line strings
   * @returns {string[]} - Array of type strings, one per line
   */
  function parse(lines) {
    var types = new Array(lines.length);
    var inDialogue = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var prevLine = i > 0 ? lines[i - 1] : undefined;
      var nextLine = i < lines.length - 1 ? lines[i + 1] : undefined;
      var trimmed = line ? line.trim() : '';

      if (trimmed === '') {
        types[i] = 'action';
        inDialogue = false;
        continue;
      }

      // Page break (must check before other patterns)
      if (isPageBreak(line)) {
        types[i] = 'page_break';
        inDialogue = false;
        continue;
      }

      // Section headers
      if (isSection(line)) {
        var depth = getSectionDepth(line);
        types[i] = 'section_h' + depth;
        inDialogue = false;
        continue;
      }

      // Synopsis
      if (isSynopsis(line)) {
        types[i] = 'synopsis';
        inDialogue = false;
        continue;
      }

      // Note (single-line only for now)
      if (isNote(line)) {
        types[i] = 'note';
        inDialogue = false;
        continue;
      }

      // Lyrics
      if (isLyrics(line)) {
        types[i] = 'lyrics';
        inDialogue = false;
        continue;
      }

      // Scene heading
      if (isSceneHeading(line) && isBlank(prevLine)) {
        types[i] = 'scene_heading';
        inDialogue = false;
        continue;
      }

      // Forced scene heading (even without blank line before)
      if (line && line.trim().charAt(0) === '.' && line.trim().charAt(1) !== '.') {
        types[i] = 'scene_heading';
        inDialogue = false;
        continue;
      }

      // Centered text
      if (isCentered(line)) {
        types[i] = 'centered';
        inDialogue = false;
        continue;
      }

      // Transition
      if (isTransition(line, prevLine, nextLine)) {
        types[i] = 'transition';
        inDialogue = false;
        continue;
      }

      // Character
      if (isCharacter(line, prevLine, nextLine)) {
        types[i] = 'character';
        inDialogue = true;
        continue;
      }

      // If we're in a dialogue block
      if (inDialogue) {
        if (isParenthetical(line)) {
          types[i] = 'parenthetical';
          continue;
        }
        // Dialogue continues until blank line
        types[i] = 'dialogue';
        continue;
      }

      // Default: action
      types[i] = 'action';
    }

    return types;
  }

  return {
    parse: parse
  };
})();

if (typeof exports !== 'undefined') {
  exports.FountainParser = FountainParser;
}
