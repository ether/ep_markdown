'use strict';

// Unit tests for the Markdown exporter (issue #156). These drive
// `getMarkdownFromAtext` directly against a hand-built atext, so they need no
// running server, and they render the result with showdown (the same library
// the plugin uses for Markdown *import*) to assert what the exported Markdown
// actually looks like once rendered.

import * as Changeset from 'ep_etherpad-lite/static/js/Changeset';
import AttributePool from 'ep_etherpad-lite/static/js/AttributePool';

const assert = require('assert').strict;
const showdown = require('showdown');
const {getMarkdownFromAtext} = require('ep_markdown/exportMarkdown');

// Builds an atext out of [text, attributes] pairs, e.g.
//   [['*', [['list', 'bullet1']]], ['hello\n', [['bold', 'true']]]]
const toMarkdown = (segments: any[][]) => {
  const pool = new AttributePool();
  let atext = Changeset.makeAText('\n');
  for (const [text, attribs] of segments) {
    const cs = Changeset.makeSplice(
        atext.text, atext.text.length - 1, 0, text, attribs || [], pool);
    atext = Changeset.applyToAText(cs, atext, pool);
  }
  return getMarkdownFromAtext({apool: () => pool, atext}, atext);
};

const toHtml = (markdown: string) => new showdown.Converter().makeHtml(markdown);

describe('ep_markdown export (issue #156)', function () {
  describe('escaping', function () {
    it('does not escape underscores inside a code span', function () {
      const md = toMarkdown([['`under_score`\n', []]]);
      assert.ok(md.includes('`under_score`'), md);
      assert.ok(!md.includes('\\_'), md);
      assert.equal(toHtml(md).trim(), '<p><code>under_score</code></p>');
    });

    it('still escapes underscores outside a code span', function () {
      const md = toMarkdown([['snake_case\n', []]]);
      assert.ok(md.includes('snake\\_case'), md);
      assert.equal(toHtml(md).trim(), '<p>snake_case</p>');
    });

    it('does not escape a code line', function () {
      const md = toMarkdown([['*', [['heading', 'code']]], ['a_b & c\n', []]]);
      assert.ok(md.includes('    a_b & c'), md);
      assert.ok(!md.includes('\\'), md);
    });
  });

  describe('links', function () {
    it('keeps formatting markers out of a link inside a bold line', function () {
      const md = toMarkdown([
        ['bold ', [['bold', 'true']]],
        ['https://example.com/a_b', [['bold', 'true']]],
        [' tail\n', [['bold', 'true']]],
      ]);
      // No emphasis marker may leak into the link text or destination, and a
      // closing `**` must not follow a space — CommonMark would not close the
      // span and the whole run would stay literal.
      assert.ok(!/\[[^\]]*\*/.test(md), md);
      assert.ok(!/\([^)]*\*/.test(md), md);
      assert.ok(md.includes('**bold** ['), md);
      assert.equal(
          toHtml(md).trim(),
          '<p><strong>bold</strong> <a href="https://example.com/a_b">' +
          'https://example.com/a_b</a> <strong>tail</strong></p>');
    });

    it('does not backslash-escape the link destination', function () {
      const md = toMarkdown([['https://example.com/a_b&c\n', []]]);
      assert.ok(md.includes('(https://example.com/a_b&c)'), md);
    });
  });

  describe('lines that only look like Markdown blocks', function () {
    it('does not turn an indented line into a code block', function () {
      const md = toMarkdown([
        ['Bonjour\n', []],
        ['    - un texte normal\n', []],
        ['une suite\n', []],
      ]);
      for (const line of md.split('\n')) {
        assert.ok(!/^(?: {4}|\t)/.test(line), `indented line kept: ${md}`);
      }
      assert.ok(toHtml(md).includes('<p>- un texte normal</p>'), toHtml(md));
      assert.ok(!toHtml(md).includes('<code>'), toHtml(md));
    });

    it('keeps a plain line that starts with "- " a paragraph', function () {
      const md = toMarkdown([['- not a list\n', []]]);
      assert.equal(toHtml(md).trim(), '<p>- not a list</p>');
    });

    it('keeps a plain line that starts with "1. " a paragraph', function () {
      const md = toMarkdown([['1. not a list\n', []]]);
      assert.equal(toHtml(md).trim(), '<p>1. not a list</p>');
    });

    it('keeps a plain line that starts with "# " a paragraph', function () {
      const md = toMarkdown([['# not a heading\n', []]]);
      assert.equal(toHtml(md).trim(), '<p># not a heading</p>');
    });

    it('keeps a bold line that starts with "- " bold text, not a list',
        function () {
          const md = toMarkdown([['- a line\n', [['bold', 'true']]]]);
          assert.equal(toHtml(md).trim(), '<p><strong>- a line</strong></p>');
        });
  });

  describe('lists', function () {
    it('exports a bold list item with the marker outside the bold run',
        function () {
          const md = toMarkdown([
            ['*', [['list', 'bullet1']]],
            ['a line\n', [['bold', 'true']]],
          ]);
          assert.ok(/^\s*\* \*\*a line\*\*$/m.test(md), md);
          assert.equal(
              toHtml(md).replace(/\n/g, ''),
              '<ul><li><strong>a line</strong></li></ul>');
        });

    it('does not swallow the paragraph that follows a list', function () {
      const md = toMarkdown([
        ['*', [['list', 'bullet1']]],
        ['item one\n', []],
        ['after list\n', []],
      ]);
      const html = toHtml(md);
      assert.ok(html.includes('<p>after list</p>'), html);
      assert.ok(!/<li>[^<]*after list/.test(html), html);
    });

    it('keeps an ordered list an ordered list', function () {
      const md = toMarkdown([
        ['*', [['list', 'number1']]],
        ['first\n', []],
      ]);
      assert.ok(/^\s*1\. first$/m.test(md), md);
      assert.ok(toHtml(md).includes('<ol>'), toHtml(md));
    });
  });

  describe('inline formatting still works', function () {
    it('exports bold, italic and strikethrough', function () {
      assert.ok(toMarkdown([['b\n', [['bold', 'true']]]]).includes('**b**'));
      assert.ok(toMarkdown([['i\n', [['italic', 'true']]]]).includes('*i*'));
      assert.ok(toMarkdown([['s\n', [['strikethrough', 'true']]]]).includes('~~s~~'));
    });

    it('exports a heading', function () {
      const md = toMarkdown([['*', [['heading', 'h2']]], ['Title\n', []]]);
      assert.ok(md.includes('## Title'), md);
    });
  });
});
