# ep_fountain

Etherpad plugin for collaborative [Fountain](https://fountain.io) screenplay editing.

## Features

- **Real-time syntax highlighting** — Scene headings, characters, dialogue, transitions, and more are styled automatically as you type
- **Collaborative** — Multiple writers can edit the same screenplay simultaneously
- **Pure Fountain** — The pad text remains valid Fountain plain text at all times
- **Export** — Download your screenplay as a `.fountain` file

## Installation

```bash
npm install ep_fountain
```

Or clone into your Etherpad `node_modules/` directory:

```bash
cd /path/to/etherpad-lite/node_modules
git clone https://github.com/adn-dan/ep_fountain_2.git ep_fountain
cd ep_fountain && npm install
```

## Supported Fountain Elements

- Scene headings (`INT.`, `EXT.`, etc.)
- Characters and dialogue
- Parentheticals
- Transitions (`CUT TO:`, `FADE TO:`, etc.)
- Action lines
- Centered text
- Sections (`#`, `##`, etc.)
- Synopsis (`=`)
- Notes (`[[...]]`)
- Lyrics (`~`)
- Page breaks (`===`)

## Development

```bash
docker run -d --name etherpad -p 9001:9001 \
  -v $(pwd):/opt/etherpad-lite/node_modules/ep_fountain \
  etherpad/etherpad
```

## License

MIT
