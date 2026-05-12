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
- trace generation stops once the visualization reaches 1000 frames
- long-running runs are terminated after 30 seconds instead of blocking the page indefinitely

## Supported Visualization Primitives

Current public `dsviz` APIs:
- `VisArray`
- `VisMap`
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
- multiple independent tree panels in one run
- node updates through normal attribute assignment
- temporary disconnected tree components staying visible during rebuild workflows

### `VisMap`

Currently supports:
- scalar keys
- scalar values
- `VisXxx` child references as clickable cross-panel tokens
- non-clickable degraded summaries after `delVis(child)`
- top-level map mutations through normal dictionary-style operations

Current map-like operations include:
- `__getitem__`
- `__setitem__`
- `__delitem__`
- `get`
- `pop`
- `clear`
- `update`
- `keys`
- `values`
- `items`

### `VisListNode`

Currently supports:
- `val`
- `right`
- multiple independent list panels in one run
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
- rewiring a node out of a tree or list does not automatically hide it; use `delVis(...)` when the detached object should disappear from the canvas

Design intent:
- `delVis(...)` is an explicit user-controlled noise-reduction tool, not an automatic cleanup rule
- the runtime does not try to infer whether a detached node is still algorithmically important
- detached nodes may still matter later in rebuild, reconnect, or rotation-heavy tree workflows
- some nodes may no longer be useful to show even if they were never fully detached, such as duplicate list nodes that are skipped or bypassed
- because the target user is expected to understand their own algorithm state, final visibility control is left to user code instead of automatic inference

## Current Interaction Model

The visualization system now follows one shared interaction model across arrays, maps, trees, and lists.

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
- `Multi Panel`

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
- [V3-summary.md](V3-summary.md)
- [docs/v3-spec.md](docs/v3-spec.md)
- [components/workbench/workbench.tsx](components/workbench/workbench.tsx)
- [components/workbench/pyodide-runner.ts](components/workbench/pyodide-runner.ts)
- [public/py/dsviz.py](public/py/dsviz.py)

If you are continuing development, start with `V3-summary.md` first.

## Planned Follow-Up

The current prototype is already usable, but several follow-up areas remain:
- expand the reference-first nested container model from `VisMap` to future `VisSet`, `VisQueue`, `VisStack`, and `VisHeap`
- keep tuning compact layout defaults for large or unusual traces
- extend the same interaction model to future structures
- consider editor-assisted help for inserting `watch(...)`
- consider whether the fixed 1000-frame cap and 30-second timeout should become configurable

### Planned Nested Container Rule

For future container-style structures such as `VisMap`, `VisSet`, `VisQueue`, `VisStack`, and `VisHeap`, nested visualization should default to references rather than duplicated inline rendering.

Planned behavior:
- each `VisXxx` object still owns its own floating panel
- if one `VisXxx` object is stored inside another `VisXxx`, the parent shows a clickable reference token instead of expanding the full child structure inline
- clicking that token should behave like clicking the child's tab: bring that child panel to the front and track the canvas to it
- plain Python values still render inline; only explicit `VisXxx` objects become cross-panel references
- if `delVis(child)` removes a child visualization, any parent reference to it should degrade into a non-clickable summary instead of a broken link

Planned naming rule:
- prefer the variable name when one is available
- if multiple visible objects share the same variable-style name, preserve the original meaningful name when possible and disambiguate repeated names with numeric suffixes such as `node1`, `node2`, ...
- this is intended to keep labels such as `head` and `tail` intact while still distinguishing repeated loop-local names

## Non-Goals For Now

Still out of scope for the current prototype:
- backend execution
- authentication
- save/share flows
- Java support
- automatic visualization of arbitrary Python state without explicit instrumentation
