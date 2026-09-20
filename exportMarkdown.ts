'use strict';


import {splitAttributionLines, opIterator,subattribution,eachAttribNumber, opAttributeValue} from 'ep_etherpad-lite/static/js/Changeset'
import {StringIterator} from 'ep_etherpad-lite/static/js/StringIterator'

const padManager = require('ep_etherpad-lite/node/db/PadManager');
// ReadOnlyManager uses `export default {...}` (ESM-style), so when loaded
// via CommonJS `require` the API lives under `.default`. Unwrap explicitly
// so `readOnlyManager.isReadOnlyId` resolves.
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager').default;

// A line is assembled as a list of tokens rather than a flat string so that the
// Markdown we emit ourselves can be told apart from the pad's own text:
//   {t: 'text'}          text taken from the pad (escaped on output)
//   {t: 'open'|'close'}  an inline formatting marker we emitted (`**`, `*`, ...)
//   {t: 'raw'}           Markdown we emitted that must not be escaped
//                        (the heading prefix, a `[url](url)` link)
// Keeping them apart is what allows the whitespace / escaping passes below to
// fix up the emitted Markdown without mangling the author's own characters.

// CommonMark only lets `**`/`*`/`~~` close a span when the marker is *not*
// preceded by whitespace (and only open one when it is not followed by
// whitespace). `**bold **[link](...)` therefore does not render as bold at
// all — the run stays literal. Move any whitespace that ended up inside a
// span to the outside of it. (#156: "a link in a bold line is corrupted")
const _normalizeTagWhitespace = (tokens) => {
  for (let pass = 0; pass < tokens.length + 1; pass++) {
    let changed = false;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.t === 'open') {
        const next = tokens[i + 1];
        if (next && next.t === 'text') {
          const ws = /^[ \t]+/.exec(next.v);
          if (ws) {
            next.v = next.v.slice(ws[0].length);
            tokens.splice(i, 0, {t: 'text', v: ws[0]});
            changed = true;
          }
        }
      } else if (tok.t === 'close') {
        const prev = tokens[i - 1];
        if (prev && prev.t === 'text') {
          const ws = /[ \t]+$/.exec(prev.v);
          if (ws) {
            prev.v = prev.v.slice(0, -ws[0].length);
            tokens.splice(i + 1, 0, {t: 'text', v: ws[0]});
            changed = true;
          }
        }
      }
    }
    // An emphasis run that is now empty (`****`) would be emitted verbatim.
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i].t === 'open' && tokens[i + 1].t === 'close' &&
          tokens[i].i === tokens[i + 1].i) {
        tokens.splice(i, 2);
        changed = true;
        i--;
      }
    }
    if (!changed) break;
  }
  return tokens;
};

// The pad's own text, as far as the first token that is not pad text. Used to
// decide what the *start of the line* looks like to a Markdown parser.
const _leadingPadText = (tokens, maxChars) => {
  let out = '';
  for (const tok of tokens) {
    if (tok.t === 'open' || tok.t === 'close') continue;
    if (tok.t !== 'text') break; // a link etc. — stop, we only care about the start
    out += tok.v;
    if (out.length >= maxChars) break;
  }
  return out.slice(0, maxChars);
};

// Drop `count` characters of pad text from the front of the line.
const _dropLeadingPadChars = (tokens, count) => {
  for (const tok of tokens) {
    if (count <= 0) break;
    if (tok.t !== 'text') {
      if (tok.t === 'open' || tok.t === 'close') continue;
      break;
    }
    const take = Math.min(count, tok.v.length);
    tok.v = tok.v.slice(take);
    count -= take;
  }
};

// Insert `str` `offset` characters into the pad text of the line.
const _insertAtPadOffset = (tokens, offset, str) => {
  for (const tok of tokens) {
    if (tok.t === 'open' || tok.t === 'close') continue;
    if (tok.t !== 'text') break;
    if (offset <= tok.v.length) {
      tok.v = tok.v.slice(0, offset) + str + tok.v.slice(offset);
      return;
    }
    offset -= tok.v.length;
  }
};

// Block-level Markdown constructs that a *plain* pad line would be turned into
// by a Markdown parser even though the pad holds no such structure: a bullet or
// numbered list, an ATX heading, a block quote, a fence or a thematic break.
// Each entry returns the index (within the line's text) of the character that
// has to be backslash-escaped to keep the line a plain paragraph.
const _BLOCK_STARTERS = [
  /^([ \t]*)()[-+*](?:[ \t]|$)/, // - bullet
  /^([ \t]*)(\d{1,9})[.)](?:[ \t]|$)/, // 1. ordered list
  /^([ \t]*)()#{1,6}(?:[ \t]|$)/, // # heading
  /^([ \t]*)()>/, // > block quote
  /^([ \t]*)()(?:`{3,}|~{3,})/, // ``` fence
  /^([ \t]*)()([-*_])[ \t]*(?:\3[ \t]*){2,}$/, // --- thematic break
];

// Markdown treats a line indented by four or more spaces as a code block, so a
// pad line that merely *looks* indented comes out as code (#156: "a line that
// starts with spaces then dash then space produces a code block"). Markdown
// cannot represent leading indentation in a paragraph at all, so clamp it to
// three spaces — enough to keep a visual hint, never enough to start a code
// block — and escape any block marker that follows so the line stays a plain
// paragraph, exactly as the pad renders it.
const _escapeBlockStart = (tokens) => {
  const MAX_INDENT = 3;
  let prefix = _leadingPadText(tokens, 64);
  const indent = /^[ \t]*/.exec(prefix)[0];
  const width = [...indent].reduce((n, c) => (c === '\t' ? n + 4 : n + 1), 0);
  if (width > MAX_INDENT) {
    _dropLeadingPadChars(tokens, indent.length);
    _insertAtPadOffset(tokens, 0, ' '.repeat(MAX_INDENT));
    prefix = _leadingPadText(tokens, 64);
  }
  for (const re of _BLOCK_STARTERS) {
    const m = re.exec(prefix);
    if (m) {
      _insertAtPadOffset(tokens, m[1].length + m[2].length, '\\');
      return tokens;
    }
  }
  return tokens;
};

// `&` and `_` are escaped so that they survive as literal characters, but
// inside a code span a backslash is *not* an escape — `` `a\_b` `` renders as
// `a\_b`. Track backtick runs and leave code spans alone (#156: "underscores
// in a code block are escaped and appear as \_").
const _joinTokens = (tokens, escapeText) => {
  let out = '';
  let fence = 0; // length of the backtick run that opened the current code span
  for (const tok of tokens) {
    if (tok.t !== 'text' || !escapeText) {
      out += tok.v;
      continue;
    }
    for (let i = 0; i < tok.v.length; i++) {
      const c = tok.v[i];
      if (c === '`') {
        let run = 1;
        while (tok.v[i + run] === '`') run++;
        if (fence === 0) fence = run;
        else if (fence === run) fence = 0;
        out += tok.v.substr(i, run);
        i += run - 1;
      } else if (fence === 0 && (c === '&' || c === '_')) {
        out += `\\${c}`;
      } else {
        out += c;
      }
    }
  }
  return out;
};

const getMarkdownFromAtext = (pad, atext) => {
  const apool = pad.apool();
  const textLines = atext.text.slice(0, -1).split('\n');
  const attribLines = splitAttributionLines(atext.attribs, atext.text);
  const tags = ['**', '*', '[]', '~~'];
  const props = ['bold', 'italic', 'underline', 'strikethrough'];
  const anumMap = {};

  props.forEach((propName, i) => {
    const propTrueNum = apool.putAttrib([propName, true], true);
    if (propTrueNum >= 0) {
      anumMap[propTrueNum] = i;
    }
  });

  const headingtags = ['# ', '## ', '### ', '#### ', '##### ', '###### ', '    '];
  const headingprops = [
    ['heading', 'h1'],
    ['heading', 'h2'],
    ['heading', 'h3'],
    ['heading', 'h4'],
    ['heading', 'h5'],
    ['heading', 'h6'],
    ['heading', 'code'],
  ];
  const headinganumMap = {};

  headingprops.forEach((prop, i) => {
    let name;
    let value;
    if (typeof prop === 'object') {
      name = prop[0];
      value = prop[1];
    } else {
      name = prop;
      value = true;
    }
    const propTrueNum = apool.putAttrib([name, value], true);
    if (propTrueNum >= 0) {
      headinganumMap[propTrueNum] = i;
    }
  });

  const getLineMarkdown = (text, attribs) => {
    const propVals = [false, false, false];
    const ENTER = 1;
    const STAY = 2;
    const LEAVE = 0;

    // Use order of tags (b/i/u) as order of nesting, for simplicity
    // and decent nesting.  For example,
    // <b>Just bold<b> <b><i>Bold and italics</i></b> <i>Just italics</i>
    // becomes
    // <b>Just bold <i>Bold and italics</i></b> <i>Just italics</i>
    const taker = new StringIterator(text);
    const tokens = [];
    const appendText = (v) => {
      if (v) tokens.push({t: 'text', v});
    };
    const appendRaw = (v) => {
      if (v) tokens.push({t: 'raw', v});
    };

    const openTags = [];
    const emitOpenTag = (i) => {
      openTags.unshift(i);
      tokens.push({t: 'open', i, v: tags[i]});
    };

    const emitCloseTag = (i) => {
      openTags.shift();
      tokens.push({t: 'close', i, v: tags[i]});
    };

    const orderdCloseTags = (tags2close) => {
      for (let i = 0; i < openTags.length; i++) {
        for (let j = 0; j < tags2close.length; j++) {
          if (tags2close[j] === openTags[i]) {
            emitCloseTag(tags2close[j]);
            i--;
            break;
          }
        }
      }
    };

    // start heading check
    let heading = false;
    let deletedAsterisk = false; // we need to delete * from the beginning of the heading line
    const iter2 = opIterator(subattribution(attribs, 0, 1));
    if (iter2.hasNext()) {
      const o2 = iter2.next();

      // iterate through attributes
      eachAttribNumber(o2.attribs, (a) => {
        if (a in headinganumMap) {
          const i = headinganumMap[a]; // i = 0 => bold, etc.
          heading = headingtags[i];
        }
      });
    }

    if (heading) {
      appendRaw(heading);
    }

    const urls = _findURLs(text);

    let idx = 0;

    const processNextChars = (numChars) => {
      if (numChars <= 0) {
        return;
      }

      const iter = opIterator(subattribution(attribs, idx, idx + numChars));
      idx += numChars;

      while (iter.hasNext()) {
        const o = iter.next();
        let propChanged = false;
        eachAttribNumber(o.attribs, (a) => {
          if (a in anumMap) {
            const i = anumMap[a]; // i = 0 => bold, etc.
            if (!propVals[i]) {
              propVals[i] = ENTER;
              propChanged = true;
            } else {
              propVals[i] = STAY;
            }
          }
        });
        for (let i = 0; i < propVals.length; i++) {
          if (propVals[i] === true) {
            propVals[i] = LEAVE;
            propChanged = true;
          } else if (propVals[i] === STAY) {
            propVals[i] = true; // set it back
          }
        }

        // now each member of propVal is in {false,LEAVE,ENTER,true}
        // according to what happens at start of span
        if (propChanged) {
          // leaving bold (e.g.) also leaves italics, etc.
          let left = false;
          for (let i = 0; i < propVals.length; i++) {
            const v = propVals[i];
            if (!left) {
              if (v === LEAVE) {
                left = true;
              }
            } else if (v === true) {
              propVals[i] = STAY; // tag will be closed and re-opened
            }
          }

          const tags2close = [];

          for (let i = propVals.length - 1; i >= 0; i--) {
            if (propVals[i] === LEAVE) {
              // emitCloseTag(i);
              tags2close.push(i);
              propVals[i] = false;
            } else if (propVals[i] === STAY) {
              // emitCloseTag(i);
              tags2close.push(i);
            }
          }

          orderdCloseTags(tags2close);

          for (let i = 0; i < propVals.length; i++) {
            if (propVals[i] === ENTER || propVals[i] === STAY) {
              emitOpenTag(i);
              propVals[i] = true;
            }
          }
          // propVals is now all {true,false} again
        } // end if (propChanged)
        let chars = o.chars;
        if (o.lines) {
          chars--; // exclude newline at end of line, if present
        }

        let s = taker.take(chars);

        // removes the characters with the code 12. Don't know where they come
        // from but they break the abiword parser and are completly useless
        s = s.replace(String.fromCharCode(12), '');

        // delete * if this line is a heading
        if (heading && !deletedAsterisk) {
          s = s.substring(1);
          deletedAsterisk = true;
        }

        appendText(s);
      } // end iteration over spans in line

      const tags2close = [];
      for (let i = propVals.length - 1; i >= 0; i--) {
        if (propVals[i]) {
          tags2close.push(i);
          propVals[i] = false;
        }
      }

      orderdCloseTags(tags2close);
    }; // end processNextChars

    if (urls) {
      urls.forEach((urlData) => {
        const startIndex = urlData[0];
        const url = urlData[1];
        const urlLength = url.length;
        processNextChars(startIndex - idx);
        // Close any currently-open inline format tags (bold, italic, etc.)
        // before writing the URL. If we don't, processing the URL's chars
        // re-emits `**` / `*` markers *inside* the Markdown link token,
        // producing broken output like `[url](**https://example.com**)`
        // (regression for #156).
        const reopen = [...openTags];
        const tags2close = [...openTags];
        orderdCloseTags(tags2close);
        for (let i = 0; i < propVals.length; i++) { propVals[i] = false; }
        // Emit the whole link as one raw token — links in Markdown never
        // contain inline formatting markers, and a link destination must not
        // be backslash-escaped either.
        appendRaw(`[${url}](${taker.take(urlLength)})`);
        idx += urlLength;
        // Restore the formatting tags so any trailing same-line text picks
        // them back up.
        for (const i of reopen.slice().reverse()) {
          emitOpenTag(i);
          propVals[i] = true;
        }
      });
    }

    processNextChars(text.length - idx);

    _normalizeTagWhitespace(tokens);
    // A line that already carries a block-level attribute (heading, code) is
    // emitted with its own Markdown prefix, so its text can no longer be read
    // as the start of some other block construct.
    if (!heading) _escapeBlockStart(tokens);

    // Nothing on a code line is escaped: it is emitted verbatim inside the
    // four-space code block. Math-mode ($...$) still has no special handling
    // here — that is a separate concern.
    return _joinTokens(tokens, heading !== headingtags[6]);
  };
  // end getLineMarkdown
  const pieces = [];

  // Need to deal with constraints imposed on HTML lists; can
  // only gain one level of nesting at once, can't change type
  // mid-list, etc.
  // People might use weird indenting, e.g. skip a level,
  // so we want to do something reasonable there.  We also
  // want to deal gracefully with blank lines.
  // => keeps track of the parents level of indentation
  const lists = []; // e.g. [[1,'bullet'], [3,'bullet'], ...]
  let prevWasListItem = false;
  for (let i = 0; i < textLines.length; i++) {
    const line = _analyzeLine(textLines[i], attribLines[i], apool);
    const lineContent = getLineMarkdown(line.text, line.aline);

    // A plain line straight after a list item is a "lazy continuation" in
    // Markdown and gets swallowed into that item. Close the list with a blank
    // line first so the paragraph stays a paragraph.
    if (prevWasListItem && !line.listLevel) pieces.push('\n');
    prevWasListItem = !!line.listLevel;

    // If we are inside a list
    if (line.listLevel) {
      // do list stuff
      let whichList = -1; // index into lists or -1
      if (line.listLevel) {
        whichList = lists.length;
        for (let j = lists.length - 1; j >= 0; j--) {
          if (line.listLevel <= lists[j][0]) {
            whichList = j;
          }
        }
      }

      // means we are on a deeper level of indentation than the
      // previous line
      if (whichList >= lists.length) {
        lists.push([line.listLevel, line.listTypeName]);
      }

      if (line.listTypeName === 'number') {
        pieces.push(`\n${(new Array(line.listLevel * 4))
            .join(' ')}1. `, lineContent || '\n'); // problem here
      } else {
        pieces.push(`\n${(new Array(line.listLevel * 4))
            .join(' ')}* `, lineContent || '\n'); // problem here
      }
    } else {
      // outside any list
      pieces.push('\n', lineContent, '\n');
    }
  }
  return pieces.join('');
};

const _analyzeLine = (text, aline, apool) => {
  const line = {};

  // identify list
  let lineMarker = 0;
  line.listLevel = 0;
  if (aline) {
    const opIter = opIterator(aline);
    if (opIter.hasNext()) {
      let listType = opAttributeValue(opIter.next(), 'list', apool);
      if (listType) {
        lineMarker = 1;
        listType = /([a-z]+)([12345678])/.exec(listType);
        if (listType) {
          line.listTypeName = listType[1];
          line.listLevel = Number(listType[2]);
        }
      }
    }
  }
  if (lineMarker) {
    line.text = text.substring(1);
    line.aline = subattribution(aline, 1);
  } else {
    line.text = text;
    line.aline = aline;
  }

  return line;
};

const getPadMarkdown = async (pad, revNum) => {
  const atext = revNum == null ? pad.atext : await pad.getInternalRevisionAText(revNum);
  return getMarkdownFromAtext(pad, atext);
};

// Readonly pad IDs (`r.*`) must be resolved to their underlying pad ID
// before loading — otherwise padManager.getPad creates an empty pad under
// the readonly ID and the export returns nothing. Matches the behavior of
// Etherpad core's /export/:type handler (see importexport.ts).
const resolvePadId = async (padId) => {
  if (readOnlyManager.isReadOnlyId(padId)) {
    return await readOnlyManager.getPadId(padId);
  }
  return padId;
};

// Exported for the unit tests (static/tests/backend/specs/exportMarkdown.ts).
exports.getMarkdownFromAtext = getMarkdownFromAtext;

exports.getPadMarkdownDocument =
    async (padId, revNum) => {
      const resolvedId = await resolvePadId(padId);
      return await getPadMarkdown(await padManager.getPad(resolvedId), revNum);
    };

// copied from ACE
const _REGEX_WORDCHAR = new RegExp([
  '[',
  '\u0030-\u0039',
  '\u0041-\u005A',
  '\u0061-\u007A',
  '\u00C0-\u00D6',
  '\u00D8-\u00F6',
  '\u00F8-\u00FF',
  '\u0100-\u1FFF',
  '\u3040-\u9FFF',
  '\uF900-\uFDFF',
  '\uFE70-\uFEFE',
  '\uFF10-\uFF19',
  '\uFF21-\uFF3A',
  '\uFF41-\uFF5A',
  '\uFF66-\uFFDC',
  ']',
].join(''));
const _REGEX_URLCHAR = new RegExp(`([-:@a-zA-Z0-9_.,~%+/\\?=&#;()$]|${_REGEX_WORDCHAR.source})`);
const _REGEX_URL = new RegExp(
    '(?:(?:https?|s?ftp|ftps|file|smb|afp|nfs|(x-)?man|gopher|txmt)://|mailto:)' +
      `${_REGEX_URLCHAR.source}*(?![:.,;])${_REGEX_URLCHAR.source}`, 'g');
// returns null if no URLs, or [[startIndex1, url1], [startIndex2, url2], ...]
const _findURLs = (text) => {
  _REGEX_URL.lastIndex = 0;
  let urls = null;
  let execResult;
  while ((execResult = _REGEX_URL.exec(text))) {
    urls = (urls || []);
    const startIndex = execResult.index;
    const url = execResult[0];
    urls.push([startIndex, url]);
  }
  return urls;
};
