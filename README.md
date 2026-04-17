![Publish Status](https://github.com/ether/ep_markdown/workflows/Node.js%20Package/badge.svg) [![Backend Tests Status](https://github.com/ether/ep_markdown/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/ether/ep_markdown/actions/workflows/test-and-release.yml)

Markdown editing in Etherpad
============================

![Alt Text](http://i.imgur.com/bGZHFqH.gif "ep_markdown in action")

Features
========

* Use the normal editbar buttons to add markdown.
* Import as Markdown (automatically applies styling / text attributes).
* Export as Markdown.
* Localizations.

Usage
=====

To enable Markdown view click Settings -> Markdown

Limitations
===========
This plugin is not designed for you to write Markdown and it format that markdown with styling.  So you can't expect to type \*\*blah\*\* and expect to see blah in bold.  You can however type blah, set it as bold and then click "Show as Markdown" and it will show \*\*bold\*\*.  I will not be adding support for supporting typing in markdown which will render to a style because it will be impossible to handle character control.

Setting as default
==================

Paste the below into your settings.

"ep_markdown_default": true,

Todo
====
* Support ALL styles fully (please let me know what does / doesn't work)
* Create markdown icon for export menu
* Better code block support (currently it's line by line)
* Import Markdown (and it applies formatting automatically)

Requirements
============

Etherpad 1.8.1

## Installation

Install from the Etherpad admin UI (**Admin → Manage Plugins**,
search for `ep_markdown` and click *Install*), or from the Etherpad
root directory:

```sh
pnpm run plugins install ep_markdown
```

> ⚠️ Don't run `npm i` / `npm install` yourself from the Etherpad
> source tree — Etherpad tracks installed plugins through its own
> plugin-manager, and hand-editing `package.json` can leave the
> server unable to start.

After installing, restart Etherpad.
