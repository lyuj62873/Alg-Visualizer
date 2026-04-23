# AlgoLens V1 Summary

## Purpose
This document is the fastest way for a new agent to understand the current state of the repo after the v1 implementation pass.

Use this together with:
- `AGENT.md`
- `docs/v1-spec.md`
- `PROJECT_PROPOSAL.md`

Those files describe the intended product direction. This file describes what was actually built, what changed during implementation, and what is still unresolved.

## Current Product State
AlgoLens v1 is a working browser-based Python visualization workbench.

Implemented end-to-end flow:
1. The user writes Python code in Monaco.
2. The user defines input directly inside `run_case()`.
3. The code runs in Pyodide in the browser.
4. `dsviz` emits a full trace of render-ready frames.
5. The frontend replays those frames with `Prev` and `Next`.
6. The editor highlights the currently executing line for the active frame.
7. Visualized arrays, trees, watched scalars, and runtime errors all update with frame changes.

## Important Product Decisions
Several planning assumptions changed during implementation.

### Input handling
Earlier drafts assumed a separate input configuration panel.

Current reality:
- there is no separate input UI
- inputs are written directly in `run_case()`
- this is closer to the intended LeetCode-style workflow and less intrusive

### Tree abstraction
Earlier drafts emphasized `VisBST`.

Current reality:
- `VisTreeNode` is the primary tree abstraction for users
- this better matches LeetCode-style `TreeNode` problems
- `VisBST` still exists in `public/py/dsviz.py`, but it is not the main path

### Navigation content
Earlier UI drafts used `Trace` plus `Examples`.

Current reality:
- top nav now contains `Workbench`, `Examples`, and `Guides`
- `Examples` is for runnable algorithm demos
- `Guides` is for focused DS usage examples

## Major Implementation Work Completed

### Frontend workbench
Implemented:
- single-page Next.js workbench
- Monaco editor
- resizable editor/visualization split
- floating step controls
- floating variables/output sidebar
- structured runtime error display

Relevant files:
- `components/workbench/workbench.tsx`
- `components/workbench/editor-pane.tsx`
- `components/workbench/results-pane.tsx`
- `app/globals.css`

### Python execution and tracing
Implemented:
- Pyodide loader and runtime bridge
- injection of `dsviz.py` into the Pyodide environment
- fixed `run_case()` entry point
- full trace export to the frontend
- runtime error capture with traceback and line number
- source line tracking through `sys.settrace`

Relevant files:
- `components/workbench/pyodide-runner.ts`
- `public/py/dsviz.py`

### Visualization primitives
Implemented:
- `VisArray`
- `VisTreeNode`
- explicit scalar tracking with `watch(name, value)`

`VisArray` now supports list-like operations including:
- initialization
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

`VisTreeNode` supports:
- `val`
- `left`
- `right`
- change tracking through `__setattr__`

Relevant file:
- `public/py/dsviz.py`

### Tree rendering
The tree renderer was changed from a custom static edge layout to `React Flow`.

Reason:
- edge tracking is more reliable when nodes move
- it is a better fit for node/edge rendering than hand-maintained SVG

Relevant file:
- `components/workbench/tree-flow.tsx`

### Examples and guides
Implemented:
- `Guides -> VisArray`
- `Guides -> VisTreeNode`
- `Examples -> Balanced Rebuild`

The `Balanced Rebuild` example demonstrates:
1. build a tree with at least 9 nodes
2. collect values by inorder traversal into `VisArray`
3. quicksort the array with explicit visible swaps
4. rebuild a balanced tree by divide and conquer

Relevant files:
- `public/examples/vis-array-example.py`
- `public/examples/vis-tree-node-example.py`
- `public/examples/balanced-rebuild-example.py`

## Editor Highlighting
Implemented:
- each frame now carries a `line` field
- Monaco uses line decorations to highlight the active statement
- the highlight updates when the user steps through frames
- runtime errors also attempt to map back to a source line

Relevant files:
- `components/workbench/editor-pane.tsx`
- `components/workbench/pyodide-runner.ts`
- `public/py/dsviz.py`

## Runtime Error UX
The output sidebar now shows:
- error type
- message
- line number when available
- traceback in a collapsible block

This replaced the earlier plain `stderr:` text dump.

## Deployment State
Deployment target is Vercel.

Current deployment-relevant notes:
- framework preset: `Next.js`
- root directory: `./`
- no required environment variables
- `next` was upgraded from `15.3.0` to `15.3.8` to clear the reported security issue

Relevant files:
- `package.json`
- `package-lock.json`

## Validation Completed
The following were explicitly checked during implementation:
- `VisArray` operations run successfully in Python
- `VisTreeNode` example runs
- `Balanced Rebuild` runs and emits a large trace
- TypeScript type check passes
- `next build` passes locally after the `next` upgrade
- built-in examples load from the navbar menus
- active-line highlighting changes when stepping frames

## Known Open Issues
These are the main unresolved items carried forward from v1.

1. Large arrays can compress until labels become unreadable.
Required fix:
- automatically expand panel width based on content count
- preserve user-controlled proportional scale after expansion

2. Tree panels need better internal navigation.
Required fix:
- make nodes and overall tree presentation more compact
- allow dragging empty space inside the panel to pan the visible tree viewport

3. `VisArray` does not truly support nested-array visualization yet.
Current limitation:
- nested arrays can be stored, but they render only as stringified top-level items
- inner-list mutations are not reliably tracked unless the modified row is written back through `VisArray.__setitem__`

Required fix:
- add nested-array-specific rendering for 2D / nested structures
- add child-level change tracking so inner mutations emit trace frames correctly

4. Panel dragging interaction is rough.
Current problems:
- a visible jump/reposition can happen when drag starts
- text-selection blue highlight can appear while dragging
- drag behavior needs smoothing and better pointer handling

These are accepted carry-over issues for the next iteration.

## Recommended Next Iteration
Priority order for the next pass:
1. fix panel drag UX
2. make array panels auto-expand for long arrays
3. add tree viewport panning and better compact layout
4. add nested-array rendering and child mutation tracking for `VisArray`
5. add more `dsviz` structures
6. revisit an editor-assisted `watch(...)` insertion workflow

## Fast Start For A New Agent
If a new agent needs to continue this repo, the most useful reading order is:
1. `V1-summary.md`
2. `AGENT.md`
3. `docs/v1-spec.md`
4. `components/workbench/workbench.tsx`
5. `components/workbench/pyodide-runner.ts`
6. `public/py/dsviz.py`

That is enough to understand both the intended workflow and the shipped architecture without reconstructing the whole history from scratch.
