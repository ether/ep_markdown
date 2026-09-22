# Agent Guide — ep_markdown

Edit and Export as Markdown in Etherpad.

## Tech stack

* Etherpad plugin framework (hooks declared in `ep.json`)
* EJS templates rendered server-side via `eejsBlock_*` hooks
* html10n for i18n (`locales/<lang>.json`, `data-l10n-id` in templates)
* `ep_plugin_helpers` for shared boilerplate
* `markdown-it` for the `.md` import path (`importMarkdown.ts`). The export
  path (`exportMarkdown.ts`) is hand-written and uses no parser.

## Project structure

```
ep_markdown/
├── AGENTS.md
├── CONTRIBUTING.md
├── ep.json
├── exportMarkdown.ts
├── express.ts
├── importMarkdown.ts
├── index.ts
├── locales/
│   ├── ar.json
│   ├── bn.json
│   ├── ca.json
│   ├── cs.json
│   ├── de.json
│   ├── diq.json
│   └── ...
├── package.json
├── static/
│   ├── css/
│   ├── js/
│   ├── tests/
├── templates/
│   ├── exportcolumn.html
```

## Helpers used

* `padToggle` (client sub-path) from `ep_plugin_helpers`


## Helpers NOT used

_To be audited in the helpers-adoption sweep (Phase 4)._


## Running tests locally

`ep_markdown` runs inside Etherpad's test harness. From an etherpad checkout that has installed this plugin via `pnpm run plugins i --path ../ep_markdown`:

```bash
# Backend (Mocha) — harness boots its own server
pnpm --filter ep_etherpad-lite run test

# Playwright — needs `pnpm run dev` in a second terminal
pnpm --filter ep_etherpad-lite run test-ui
```

## Standing rules for agent edits

* PRs target `main`. Linear commits, no merge commits.
* Every bug fix includes a regression test in the same commit.
* All user-facing strings in `locales/`. No hardcoded English in templates.
* No hardcoded `aria-label` on icon-only controls — etherpad's html10n auto-populates `aria-label` from the localized string when (a) the element has a `data-l10n-id` and (b) no author-supplied `aria-label` is present. Adding a hardcoded English `aria-label` blocks that and leaves it untranslated. (See `etherpad-lite/src/static/js/vendors/html10n.ts:665-678`.)
* No nested interactive elements (no `<button>` inside `<a>`).
* LLM/Agent contributions are explicitly welcomed by maintainers.

## Quick reference: hooks declared in `ep.json`

* Server: `expressCreateServer`, `loadSettings`, `clientVars`, `eejsBlock_exportColumn`, `eejsBlock_mySettings`, `eejsBlock_padSettings`, `import`
* Client: `aceEditorCSS`, `postAceInit`, `handleClientMessage_CLIENT_MESSAGE`

When adding a hook, register it in both `ep.json` *and* the matching `exports.<hook> = ...` in the JS file.
