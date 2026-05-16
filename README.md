# AlgoLens

AlgoLens is a browser-based visualization workbench for debugging Python algorithm code.

It is designed for real LeetCode-style problem solving, not for replaying a fixed data-structure animation. You paste Python into the editor, wrap only the structures you want to inspect, run the code in the browser, and step through the generated trace visually.

## Why AlgoLens

### 1. It supports real algorithm problems
AlgoLens is built for actual LeetCode-style workflows. It supports multiple visualization primitives, nested references between structures, and custom object panels. The goal is to visualize real problem-solving code, not just one isolated structure at a time.

### 2. It is minimally invasive
You do not need to rewrite your whole solution. In the common case, you only replace the structures you want to inspect at initialization time with `VisXxx` wrappers, then keep using them in a Python-native way.

### 3. It is visual, not text-heavy
Instead of reading long debugger dumps, you see panels, nodes, references, and changing layouts. The focus is on how the structure evolves, not on scrolling through variable text.

### 4. It replays changes instead of interrupting execution
AlgoLens generates the full trace first, then lets you move forward and backward through it. You do not have to rerun everything from the start just because you stepped past the moment you wanted to inspect.

## Why It Is Different

### 1. It is a LeetCode debugging tool, not a data-structure tutorial site
The point is not to teach what a linked list or heap looks like in isolation. The point is to help you visualize the structures that matter while you are writing and debugging an algorithm problem.

### 2. You control what gets visualized
You decide which structures should become `VisXxx`, which values should be watched, which panels should disappear with `delVis(...)`, and how different structures interact with each other. The tool does not force one rigid workflow.

## Core Features

- Browser-only execution through Pyodide in a worker.
- Explicit visualization primitives such as `VisArray`, `VisMap`, `VisTreeNode`, `VisListNode`, `VisHeap`, and `VisObject`.
- Reference-first nesting between visualized structures.
- Forward and backward trace replay with source-line highlighting.
- Built-in `User Guide`, problem-oriented `Examples`, and per-class `Vis API` content inside the app.
- Python-native convenience behavior, including preinjected helpers and `VisArray.sort(key=..., reverse=...)`.

## How It Works

1. Paste or write LeetCode-style Python in the editor.
2. Put your algorithm inside `class Solution`.
3. Build test input inside `run_case()`.
4. Replace only the structures you want to inspect with `VisXxx`.
5. Click `Run`.
6. Step through the generated trace with visual panels and watched values.

## Built-In Learning Content

AlgoLens currently ships with:

- `User Guide`
- `Examples`
- `Vis API`

The current teaching examples are:

- `LCS`
- `Group Anagrams`
- `Path Sum III`
- `LRU Cache`

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run the regression test suite:

```bash
npm run test
```

Start the production server:

```bash
npm run start
```

## Project Links

- [DETAILS.md](DETAILS.md) for the current implementation state, supported primitives, interaction model, and remaining follow-up ideas
- [AGENT.md](AGENT.md) for ongoing engineering notes
- [V3-summary.md](V3-summary.md) for the development summary
- [docs/v3-spec.md](docs/v3-spec.md) for the current V3-oriented spec notes
