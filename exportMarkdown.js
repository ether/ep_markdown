'use strict';

const async = require('ep_etherpad-lite/node_modules/async');
const Changeset = require('ep_etherpad-lite/static/js/Changeset');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const ERR = require('ep_etherpad-lite/node_modules/async-stacktrace');

exports.getPadMarkdown = (pad, revNum, callback) => {
  let atext = pad.atext;
  let Markdown;
  async.waterfall([

    // fetch revision atext
    (callback) => {
      if (revNum != null) {
        pad.getInternalRevisionAText(revNum, (err, revisionAtext) => {
          if (ERR(err, callback)) return;
          atext = revisionAtext;
          callback();
        });
      } else {
        callback(null);
      }
    },

    // convert atext to Markdown
    (callback) => {
      Markdown = getMarkdownFromAtext(pad, atext);
      callback(null);
    },
  ],

  // run final callback
  (err) => {
    if (ERR(err, callback)) return;
    callback(null, Markdown);
  });
};

const getMarkdownFromAtext = (pad, atext) => {
  const apool = pad.apool();
  const textLines = atext.text.slice(0, -1).split('\n');
  const attribLines = Changeset.splitAttributionLines(atext.attribs, atext.text);
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
    const taker = Changeset.stringIterator(text);
    let assem = Changeset.stringAssembler();

    const openTags = [];
    const emitOpenTag = (i) => {
      openTags.unshift(i);
      assem.append(tags[i]);
    };

    const emitCloseTag = (i) => {
      openTags.shift();
      assem.append(tags[i]);
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
    const iter2 = Changeset.opIterator(Changeset.subattribution(attribs, 0, 1));
    if (iter2.hasNext()) {
      const o2 = iter2.next();

      // iterate through attributes
      Changeset.eachAttribNumber(o2.attribs, (a) => {
        if (a in headinganumMap) {
          const i = headinganumMap[a]; // i = 0 => bold, etc.
          heading = headingtags[i];
        }
      });
    }

    if (heading) {
      assem.append(heading);
    }

    const urls = _findURLs(text);

    let idx = 0;

    const processNextChars = (numChars) => {
      if (numChars <= 0) {
        return;
      }

      const iter = Changeset.opIterator(Changeset.subattribution(attribs, idx, idx + numChars));
      idx += numChars;

      while (iter.hasNext()) {
        const o = iter.next();
        let propChanged = false;
        Changeset.eachAttribNumber(o.attribs, (a) => {
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

        assem.append(s);
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
        assem.append(`[${url}](`);
        processNextChars(urlLength);
        assem.append(')');
      });
    }

    processNextChars(text.length - idx);

    // replace &, _
    assem = assem.toString();
    assem = assem.replace(/&/g, '\\&');
    // this breaks Markdown math mode: $\sum_i^j$ becomes $\sum\_i^j$
    assem = assem.replace(/_/g, '\\_');

    return assem;
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
  for (let i = 0; i < textLines.length; i++) {
    const line = _analyzeLine(textLines[i], attribLines[i], apool);
    const lineContent = getLineMarkdown(line.text, line.aline);

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
    const opIter = Changeset.opIterator(aline);
    if (opIter.hasNext()) {
      let listType = Changeset.opAttributeValue(opIter.next(), 'list', apool);
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
    line.aline = Changeset.subattribution(aline, 1);
  } else {
    line.text = text;
    line.aline = aline;
  }

  return line;
};

exports.getPadMarkdownDocument = async (padId, revNum, callback) => {
  const pad = await padManager.getPad(padId);

  exports.getPadMarkdown(pad, revNum, (err, Markdown) => {
    if (ERR(err, callback)) return;
    callback(null, Markdown);
  });
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
