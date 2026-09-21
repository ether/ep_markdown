'use strict';

// Markdown -> HTML for the `.md` import hook.
//
// Etherpad core does not import Markdown directly: a plugin's `import` hook is
// expected to hand core a *HTML* file, which core then feeds to
// `ImportHtml.setPadHTML`. That re-parses the HTML with rehype (whitespace
// minification) + jsdom and maps a small allowlist of tags onto pad
// attributes, so anything core has no model for (`<script>`, `<table>`, inline
// event handlers, element ids) is dropped on the way in.
//
// This module used to be a call into `showdown`. showdown's last release was
// 2.1.0 (April 2022) and it carries three unpatched advisories, one of which
// (CVE-2024-1899) is a quadratic blow-up in its anchor parsing that a crafted
// `.md` upload can use to pin the event loop. markdown-it replaced it: it is
// actively maintained, is a CommonMark reference implementation, and does not
// degrade on that input.

// markdown-it is only ever needed when somebody actually uploads a `.md` file,
// so it is required lazily rather than at module load.
let renderer: any = null;

const getRenderer = () => {
  if (renderer != null) return renderer;
  const MarkdownIt = require('markdown-it');
  renderer = new MarkdownIt({
    // Pass raw HTML through, as showdown did. Real-world `.md` files carry
    // `<br>`, `<img>`, `<details>` and friends, and dropping them would be a
    // regression. It is not a new exposure: core's importer re-parses the
    // HTML and only keeps tags it has a pad attribute for.
    html: true,
    // showdown emitted XHTML-style void tags (`<br />`, `<hr />`). Cosmetic
    // once core re-parses, but it keeps the generated HTML byte-comparable.
    xhtmlOut: true,
    // showdown's `simpleLineBreaks` was off: a single newline is a soft break.
    breaks: false,
    // showdown's `simplifiedAutoLink` was off: a bare URL stays plain text.
    // (Etherpad linkifies URLs in the pad itself.)
    linkify: false,
    // No typographic substitution. showdown did silently rewrite `...` to an
    // ellipsis; not rewriting the author's characters is the better default.
    typographer: false,
  });
  // GFM tables are the one markdown-it default we turn off. Etherpad has no
  // table model, and core's content collector drops a `<table>` subtree
  // wholesale — an imported table would arrive as a completely *empty* pad.
  // With the rule off the pipe syntax stays literal text, which is what
  // showdown did and is the only lossless option available here.
  renderer.disable(['table']);
  return renderer;
};

/**
 * Renders a Markdown document to a complete HTML document, in the shape core's
 * `setPadHTML` expects. Mirrors showdown's `completeHTMLDocument` wrapper.
 */
const markdownToHtml = (markdown: string): string => {
  const body = getRenderer().render(markdown);
  return `<!DOCTYPE HTML>\n<html>\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n${body}</body>\n</html>`;
};

exports.markdownToHtml = markdownToHtml;
