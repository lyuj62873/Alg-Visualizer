# AlgoLens

AlgoLens is a browser-based visualization workbench for debugging Python algorithm code.

The intended workflow is:
- write or paste Python into the editor
- define test input directly inside `run_case()`
- wrap only the data structures you want to inspect with `dsviz`
- run the code in the browser through Pyodide inside a worker
- step through the generated trace frame by frame

The goal is to stay close to normal LeetCode-style Python instead of forcing users into a custom DSL.

## Current State

This repo is currently a working single-page prototype built with:
- Next.js
- Tailwind CSS
- Monaco Editor
- Pyodide
- React Flow

Current end-to-end behavior:
- Python code runs in the browser inside a dedicated worker
- `run_case()` is the fixed entry point
- the runtime generates a full replay trace first
- the frontend replays that trace with `Prev` and `Next`
- the active source line is highlighted in Monaco
- runtime errors are shown with message, traceback, and line number when available
- infinite loops are terminated by a run timeout instead of freezing the page

## Supported Visualization Primitives

Current public `dsviz` APIs:
- `VisArray`
- `VisTreeNode`
- `VisListNode`
- `watch(name, value)`
- `delVis(value)`

### `VisArray`

Currently supports:
- 1D arrays
- 2D arrays
- 3D and deeper nested lists
- tracked inner mutations without manual outer write-back

Current list-like operations include:
- `append`
- `insert`
- `__getitem__`
- `__setitem__`
- `__delitem__`
- `pop`
- `remove`
- `extend`
- `reverse`
- `clear`

### `VisTreeNode`

Currently supports:
- `val`
- `left`
- `right`
- node updates through normal attribute assignment
- temporary disconnected tree components staying visible during rebuild workflows

### `VisListNode`

Currently supports:
- `val`
- `right`
- linked-list rewiring through normal attribute assignment
- disconnected list segments staying visible during rewiring
- shared-tail rendering without duplicating the same suffix chain

### `watch(name, value)`

Use `watch(...)` for explicit scalar tracking. Watched values appear in the Variables panel and update frame by frame.

### `delVis(value)`

Use `delVis(...)` when user code wants to explicitly remove an existing visualization.

Current behavior:
- `delVis(VisArray)` removes the array panel
- `delVis(VisTreeNode)` removes that node from visualization
- `delVis(VisListNode)` removes that node from visualization

## Current Interaction Model

The visualization system now follows one shared interaction model across arrays, trees, and lists.

Shared rules:
- every structure renders in a floating panel
- drag the panel header to move the structure
- panel resize changes the outer viewport only
- wheel zoom changes the inner content scale only
- individual nodes or cells are not directly draggable

Array-specific behavior:
- compact default spacing
- non-proportional panel resize
- drag inside the panel body to pan overflowed content

Tree/List-specific behavior:
- internal panning by dragging empty space
- wheel zoom inside the viewport
- manual `Fit`
- default-on `Track` for following the active node

## Built-In Examples And Guides

Current `Examples`:
- `Balanced Rebuild`
- `Delete Duplicates`

Current `Guides`:
- `VisArray`
- `VisArray 2D/3D`
- `VisTreeNode`
- `VisListNode`

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

Start the production server:

```bash
npm run start
```

## Project Structure

Important files:
- [AGENT.md](AGENT.md)
- [V2-summary.md](V2-summary.md)
- [docs/v2-spec.md](docs/v2-spec.md)
- [components/workbench/workbench.tsx](components/workbench/workbench.tsx)
- [components/workbench/pyodide-runner.ts](components/workbench/pyodide-runner.ts)
- [public/py/dsviz.py](public/py/dsviz.py)

If you are continuing development, start with `V2-summary.md` first.

## Planned Follow-Up

The current prototype is already usable, but several follow-up areas remain:
- support multiple independent tree panels and multiple independent list panels
- improve `delVis(...)` behavior in example flows such as `Delete Duplicates`
- refine example comments and `delVis(...)` teaching patterns
- keep tuning compact layout defaults for large or unusual traces
- extend the same interaction model to future structures
- consider editor-assisted help for inserting `watch(...)`

## Non-Goals For Now

Still out of scope for the current prototype:
- backend execution
- authentication
- save/share flows
- Java support
- automatic visualization of arbitrary Python state without explicit instrumentation
