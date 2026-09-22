'use strict';

// Unit tests for the Markdown *import* path.
//
// The `.md` import hook does not build pad content itself: it renders the
// Markdown to HTML and hands that to Etherpad core, which re-parses it with
// rehype + jsdom and maps an allowlist of tags onto pad attributes. These
// tests therefore assert on the HTML the plugin produces.
//
// They exist because the renderer changed: showdown (unmaintained since
// 2.1.0, April 2022, three unpatched advisories) was replaced with
// markdown-it. The cases below pin both the constructs whose output must not
// change and the handful that deliberately did.

import {promises as fsp} from 'fs';
import * as os from 'os';
import * as path from 'path';

const assert = require('assert').strict;
const {markdownToHtml} = require('ep_markdown/importMarkdown');
const plugin = require('ep_markdown/index');

// The assertions below are about the document body, not core's wrapper.
const body = (markdown: string) => markdownToHtml(markdown)
    .replace(/^[\s\S]*?<body>\n/, '')
    .replace(/<\/body>[\s\S]*$/, '')
    .trim();

describe('ep_markdown import', function () {
  describe('document shape', function () {
    it('returns a complete HTML document', function () {
      const html = markdownToHtml('hello\n');
      assert.equal(html, '<!DOCTYPE HTML>\n<html>\n<head>\n<meta charset="utf-8">\n' +
          '</head>\n<body>\n<p>hello</p>\n</body>\n</html>');
    });

    it('handles an empty document', function () {
      assert.equal(body(''), '');
    });
  });

  describe('constructs Etherpad maps onto pad attributes', function () {
    it('renders headings', function () {
      assert.equal(body('# One\n\n## Two\n'), '<h1>One</h1>\n<h2>Two</h2>');
    });

    it('renders emphasis', function () {
      assert.equal(body('*i* **b**\n'), '<p><em>i</em> <strong>b</strong></p>');
    });

    it('renders a bullet list', function () {
      assert.equal(body('- one\n- two\n'), '<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    });

    it('renders an ordered list', function () {
      assert.equal(body('1. one\n2. two\n'), '<ol>\n<li>one</li>\n<li>two</li>\n</ol>');
    });

    it('renders a link', function () {
      assert.equal(
          body('[Etherpad](https://etherpad.org)\n'),
          '<p><a href="https://etherpad.org">Etherpad</a></p>');
    });

    it('renders a fenced code block', function () {
      assert.equal(
          body('```js\nconst a = 1;\n```\n'),
          '<pre><code class="language-js">const a = 1;\n</code></pre>');
    });

    it('renders a code span without touching its underscores', function () {
      assert.equal(body('`under_score`\n'), '<p><code>under_score</code></p>');
    });

    it('renders a blockquote', function () {
      assert.equal(body('> quoted\n'), '<blockquote>\n<p>quoted</p>\n</blockquote>');
    });
  });

  describe('options that have to stay where showdown had them', function () {
    it('does not turn a single newline into a line break', function () {
      // showdown's `simpleLineBreaks` was off.
      assert.equal(body('one\ntwo\n'), '<p>one\ntwo</p>');
    });

    it('does not auto-link a bare URL', function () {
      // showdown's `simplifiedAutoLink` was off; Etherpad linkifies pad text
      // itself, so doing it here would double up.
      assert.equal(body('see https://etherpad.org here\n'),
          '<p>see https://etherpad.org here</p>');
    });

    it('passes raw HTML through', function () {
      // Real-world .md carries <br>, <img>, <details>. Core's importer is what
      // decides which of those survive into the pad.
      assert.equal(body('a <b>bold</b> c\n'), '<p>a <b>bold</b> c</p>');
      assert.equal(body('<div class="x">raw</div>\n'), '<div class="x">raw</div>');
    });

    it('emits XHTML-style void tags, as showdown did', function () {
      assert.equal(body('a  \nb\n'), '<p>a<br />\nb</p>');
      assert.equal(body('---\n'), '<hr />');
    });
  });

  describe('GFM tables stay literal text', function () {
    // markdown-it enables GFM tables by default and we deliberately turn the
    // rule off. Etherpad has no table model and core's content collector drops
    // a <table> subtree wholesale, so a rendered table would import as a
    // completely EMPTY pad. Keeping the pipe syntax literal at least preserves
    // the text, and matches what showdown did.
    it('does not render a pipe table as <table>', function () {
      const html = body('| a | b |\n| - | - |\n| 1 | 2 |\n');
      assert.ok(!html.includes('<table'), html);
      assert.ok(html.includes('| a | b |'), html);
    });
  });

  describe('differences from showdown that are deliberate', function () {
    it('renders ~~strikethrough~~, which showdown left literal', function () {
      // The plugin's own exporter writes `~~s~~` for a struck run, so this is
      // what makes export -> import round-trip.
      assert.equal(body('a ~~struck~~ b\n'), '<p>a <s>struck</s> b</p>');
    });

    it('nests a nested list instead of flattening it', function () {
      assert.equal(
          body('- one\n- two\n  - nested\n'),
          '<ul>\n<li>one</li>\n<li>two\n<ul>\n<li>nested</li>\n</ul>\n</li>\n</ul>');
    });

    it('leaves mid-word underscores alone', function () {
      // showdown rendered `snake_case_word` as `snake<em>case</em>word`, which
      // lost the underscores from the pad entirely.
      assert.equal(body('snake_case_word\n'), '<p>snake_case_word</p>');
    });

    it('keeps a 7-hash line as text instead of dropping it', function () {
      // CommonMark caps ATX headings at 6 hashes. showdown emitted nothing at
      // all for this line, silently losing the content.
      assert.equal(body('####### seven\n'), '<p>####### seven</p>');
    });

    it('does not rewrite "..." into an ellipsis', function () {
      // showdown's `ellipsis` subparser was on by default and edited the
      // author's characters.
      assert.equal(body('wait... really?\n'), '<p>wait... really?</p>');
    });
  });

  describe('denial of service (CVE-2024-1899)', function () {
    // showdown's anchor subparser has a nested quantifier that goes quadratic
    // on this input: at 9999 repetitions (~88 KiB, well inside any sane upload
    // limit) showdown pinned the event loop for ~16s on the machine this was
    // written on, and ~67s at twice the size. Only the import/export rate
    // limiter stood between a crafted .md upload and a stalled server.
    //
    // The bound is deliberately loose -- markdown-it renders this in a couple
    // of hundred milliseconds, so a 5s budget leaves room for a slow CI runner
    // while still failing hard if a quadratic parser ever comes back.
    it('renders the published proof-of-concept input promptly', function () {
      this.timeout(30000);
      const evil = '[[[[[[[[['.repeat(9999);
      const start = Date.now();
      const html = markdownToHtml(evil);
      const elapsed = Date.now() - start;
      assert.ok(html.includes('[['), 'the input should still be rendered');
      assert.ok(elapsed < 5000, `took ${elapsed}ms, expected well under 5000ms`);
    });

    it('stays quick on a long run of unclosed link openers', function () {
      this.timeout(30000);
      const evil = `${'[a]('.repeat(20000)}x`;
      const start = Date.now();
      markdownToHtml(evil);
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 5000, `took ${elapsed}ms, expected well under 5000ms`);
    });
  });

  describe('the import hook', function () {
    let dir: string;

    before(async function () {
      dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ep_markdown-import-'));
    });

    after(async function () {
      if (dir) await fsp.rm(dir, {recursive: true, force: true});
    });

    it('converts a .md file and returns the destination', async function () {
      const srcFile = path.join(dir, 'in.md');
      const destFile = path.join(dir, 'out.html');
      await fsp.writeFile(srcFile, '# Title\n\n- a\n- b\n', 'utf8');
      const returned = await plugin.import('import', {destFile, fileEnding: '.md', srcFile});
      assert.equal(returned, destFile);
      const html = await fsp.readFile(destFile, 'utf8');
      assert.ok(html.startsWith('<!DOCTYPE HTML>'), html);
      assert.ok(html.includes('<h1>Title</h1>'), html);
      assert.ok(html.includes('<li>a</li>'), html);
    });

    it('ignores a file that is not Markdown', async function () {
      const srcFile = path.join(dir, 'in.txt');
      const destFile = path.join(dir, 'skipped.html');
      await fsp.writeFile(srcFile, 'plain\n', 'utf8');
      const returned = await plugin.import('import', {destFile, fileEnding: '.txt', srcFile});
      assert.equal(returned, undefined);
      await assert.rejects(fsp.access(destFile));
    });
  });
});
