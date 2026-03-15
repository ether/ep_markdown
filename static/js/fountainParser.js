'use strict';

/**
 * Fountain screenplay format parser for Etherpad.
 *
 * Implements context-aware, line-by-line parsing following the Fountain spec
 * (https://fountain.io/syntax). Designed for incremental re-parsing on edits.
 *
 * Fountain element types returned:
 *   scene_heading, character, dialogue, parenthetical, transition,
 *   action, centered, section, synopsis, note, lyrics, page_break,
 *   title_key, title_value, boneyard
 */

const FountainParser = (() => {
  // --- Regex patterns ---

  // Scene heading: INT., EXT., EST., INT./EXT., I/E or forced with leading .
  const SCENE_HEADING_RE =
    /^(\.(?!\.)|(?:INT|EXT|EST|INT\.?\s*\/\s*EXT|I\/E)[\s.,])/i;

  // Forced scene heading (leading dot, not two dots)
  const FORCED_SCENE_RE = /^\.[^.]/;

  // Transition: ends with "TO:" (all uppercase) or forced with leading >
  const TRANSITION_TO_RE = /^[A-Z\s]+TO:$/;
  const FORCED_TRANSITION_RE = /^>/;

  // Character: all uppercase, may end with ^ (dual dialogue), may have (extension)
  // Must be preceded by an empty line and followed by dialogue
  const CHARACTER_RE = /^[A-Z][A-Z0-9 _\-.']*(\(.*\))?(\s*\^)?$/;

  // Forced character: leading @
  const FORCED_CHARACTER_RE = /^@/;

  // Parenthetical: wrapped in ()
  const PARENTHETICAL_RE = /^\s*\(.*\)\s*$/;

  // Section headers: # to ######
  const SECTION_RE = /^(#{1,6})\s/;

  // Synopsis: starts with =
  const SYNOPSIS_RE = /^=(?!=)/;

  // Centered text: >text<
  const CENTERED_RE = /^\s*>.*<\s*$/;

  // Page break: === or more
  const PAGE_BREAK_RE = /^={3,}\s*$/;

  // Note: [[text]]
  const NOTE_RE = /^\[\[/;

  // Lyrics: starts with ~
  const LYRICS_RE = /^~/;

  // Boneyard: /* ... */
  const BONEYARD_START_RE = /^\/\*/;
  const BONEYARD_END_RE = /\*\/\s*$/;

  // Title page: key: value (only at top of document before first empty line)
  const TITLE_KEY_RE = /^[A-Za-z][A-Za-z ]*:\s*/;

  /**
   * Check if a line is empty (blank or whitespace-only).
   */
  const isEmpty = (line) => line === undefined || line === null || line.trim() === '';

  /**
   * Check if a string is all uppercase (ignoring non-letter characters).
   */
  const isUpperCase = (str) => {
    const letters = str.replace(/[^a-zA-Z]/g, '');
    return letters.length > 0 && letters === letters.toUpperCase();
  };

  /**
   * Parse an array of lines and return an array of element types,
   * one per line.
   *
   * @param {string[]} lines - array of text lines
   * @returns {string[]} - array of Fountain element type strings
   */
  const parseLines = (lines) => {
    const types = new Array(lines.length);
    let inTitlePage = true;
    let inBoneyard = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : undefined;
      const nextLine = i < lines.length - 1 ? lines[i + 1] : undefined;
      const prevType = i > 0 ? types[i - 1] : undefined;

      // --- Boneyard (block comments) ---
      if (inBoneyard) {
        types[i] = 'boneyard';
        if (BONEYARD_END_RE.test(line)) {
          inBoneyard = false;
        }
        continue;
      }
      if (BONEYARD_START_RE.test(line)) {
        inBoneyard = true;
        types[i] = 'boneyard';
        if (BONEYARD_END_RE.test(line)) {
          inBoneyard = false;
        }
        continue;
      }

      // --- Title page (key: value pairs at very beginning) ---
      if (inTitlePage) {
        if (isEmpty(line)) {
          inTitlePage = false;
          types[i] = 'action';
          continue;
        }
        if (TITLE_KEY_RE.test(line)) {
          types[i] = 'title_key';
          continue;
        }
        // Continuation of title value (indented lines after a key)
        if ((line.startsWith('   ') || line.startsWith('\t')) &&
            (prevType === 'title_key' || prevType === 'title_value')) {
          types[i] = 'title_value';
          continue;
        }
        // Not a title page line — stop title page mode
        inTitlePage = false;
      }

      // --- Empty line ---
      if (isEmpty(line)) {
        types[i] = 'action';
        continue;
      }

      // --- Page break ---
      if (PAGE_BREAK_RE.test(line)) {
        types[i] = 'page_break';
        continue;
      }

      // --- Section ---
      if (SECTION_RE.test(line)) {
        const match = line.match(SECTION_RE);
        const level = match[1].length;
        types[i] = 'section_h' + level;
        continue;
      }

      // --- Synopsis ---
      if (SYNOPSIS_RE.test(line)) {
        types[i] = 'synopsis';
        continue;
      }

      // --- Note (full line) ---
      if (NOTE_RE.test(line) && /\]\]\s*$/.test(line)) {
        types[i] = 'note';
        continue;
      }

      // --- Centered ---
      if (CENTERED_RE.test(line)) {
        types[i] = 'centered';
        continue;
      }

      // --- Lyrics ---
      if (LYRICS_RE.test(line)) {
        types[i] = 'lyrics';
        continue;
      }

      // --- Scene heading ---
      if (SCENE_HEADING_RE.test(line) && isEmpty(prevLine)) {
        types[i] = 'scene_heading';
        continue;
      }
      // Forced scene heading (no empty-line requirement for forced)
      if (FORCED_SCENE_RE.test(line)) {
        types[i] = 'scene_heading';
        continue;
      }

      // --- Forced transition ---
      if (FORCED_TRANSITION_RE.test(line) && !CENTERED_RE.test(line)) {
        types[i] = 'transition';
        continue;
      }

      // --- Transition (uppercase + TO:) ---
      if (TRANSITION_TO_RE.test(line) && isEmpty(prevLine) && isEmpty(nextLine)) {
        types[i] = 'transition';
        continue;
      }

      // --- Forced character ---
      if (FORCED_CHARACTER_RE.test(line) && isEmpty(prevLine)) {
        types[i] = 'character';
        continue;
      }

      // --- Character detection ---
      // Must be preceded by empty line, must be uppercase,
      // and must NOT be the last line (needs dialogue or parenthetical after)
      if (isEmpty(prevLine) && CHARACTER_RE.test(line.trim()) && isUpperCase(line.trim())) {
        // Look ahead: next non-empty line should exist (dialogue follows)
        if (!isEmpty(nextLine)) {
          types[i] = 'character';
          continue;
        }
      }

      // --- Parenthetical ---
      if (PARENTHETICAL_RE.test(line) &&
          (prevType === 'character' || prevType === 'dialogue')) {
        types[i] = 'parenthetical';
        continue;
      }

      // --- Dialogue ---
      if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') {
        if (!isEmpty(line)) {
          types[i] = 'dialogue';
          continue;
        }
      }

      // --- Default: action ---
      types[i] = 'action';
    }

    return types;
  };

  /**
   * Parse a full document string.
   *
   * @param {string} text - full document text
   * @returns {{lines: string[], types: string[]}}
   */
  const parse = (text) => {
    const lines = text.split('\n');
    const types = parseLines(lines);
    return {lines, types};
  };

  return {
    parse,
    parseLines,
    isEmpty,
    isUpperCase,
  };
})();

if (typeof exports !== 'undefined') {
  exports.FountainParser = FountainParser;
}
