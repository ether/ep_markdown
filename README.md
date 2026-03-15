# ep_fountain

Etherpad plugin for collaborative [Fountain](https://fountain.io) screenplay editing.

## Features (Phase 1)

- Real-time Fountain syntax highlighting in the editor
- Line-type detection: scene headings, characters, dialogue, parentheticals, transitions, actions, sections, synopses, notes, lyrics, page breaks
- Screenplay-standard formatting with Courier Prime font
- Collaborative editing support (attributes survive Changeset/Easysync operations)

## Installation

```bash
npm install ep_fountain
```

Or clone into your Etherpad `node_modules/` directory:

```bash
cd /path/to/etherpad-lite/node_modules
git clone https://github.com/adn-dan/ep_fountain_2.git ep_fountain
```

## Development with Docker

```bash
docker run -d --name etherpad -p 9001:9001 \
  -v $(pwd):/opt/etherpad-lite/node_modules/ep_fountain \
  etherpad/etherpad
```

## Fountain Syntax Reference

See [fountain.io/syntax](https://fountain.io/syntax) for the complete specification.

## License

MIT
