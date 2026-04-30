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

### Unified panel interaction model
The visualization system now follows one shared interaction model across arrays and trees.

Shared behavior:
- every structure appears in a floating panel on the visualization canvas
- the panel header drags the whole structure
- drag start no longer jumps
- panel drag suppresses accidental text selection
- single elements inside the structure are not user-draggable
- panel size and internal content scale are controlled separately

This is now the baseline standard for future structures as well.

### `VisArray` rendering direction
`VisArray` is no longer treated as a simple row-only visual.

Current behavior:
- variable names are inferred automatically when possible, so `arr = VisArray(...)` shows `arr`
- 1D arrays render as compact horizontal rows
- 2D arrays render as matrices
- 3D and deeper arrays render as stacked slices
- nested list mutations emit frames without requiring manual write-back through the outer array
- cell padding and inter-cell gaps were tightened to keep the default presentation compact
- panel width has a maximum bound; overflow is explored inside the panel rather than by unlimited outer growth
- array panel resize is non-proportional
- array content zoom uses the mouse wheel
- array overflow can be explored by dragging inside the panel body

Relevant files:
- `public/py/dsviz.py`
- `components/workbench/results-pane.tsx`
- `components/workbench/pyodide-runner.ts`

### `VisTreeNode` rendering direction
`VisTreeNode` now follows the same panel model, but keeps a tree-specific viewport inside the panel.

Current behavior:
- tree nodes are compact and non-draggable
- the user pans by dragging empty space inside the panel
- the user zooms with the mouse wheel
- tree panel resize stays proportional
- vertical level spacing is fixed and readable
- horizontal layout uses full-level binary tree slots to avoid overlap in deeper levels
- the tree auto-fits when the traced structure changes, but normal panel resize should not reset manual viewport exploration

Relevant files:
- `public/py/dsviz.py`
- `components/workbench/tree-flow.tsx`
- `components/workbench/results-pane.tsx`

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

## Current Visualization Standard
The repo now has a usable default standard for visual structures:
1. elements should start compact rather than spacious
2. the outer panel is a viewport and can be resized independently
3. inner content scale is controlled by wheel zoom, not by panel resize
4. the user moves the whole structure by dragging the panel
5. the user may pan inside the panel when the structure overflows its viewport
6. single visual elements are not draggable

This standard is now implemented for `VisArray` and `VisTreeNode` and should be reused for future structures.

## Remaining Follow-Up
The next meaningful work is no longer the old interaction fixes. Those are now in place.

More relevant follow-up areas are:
1. add more `dsviz` structures while preserving the same interaction standard
2. further tune compact defaults for atypical large values or unusual trace density
3. revisit an editor-assisted `watch(...)` insertion workflow

## Fast Start For A New Agent
If a new agent needs to continue this repo, the most useful reading order is:
1. `V1-summary.md`
2. `AGENT.md`
3. `docs/v1-spec.md`
4. `components/workbench/workbench.tsx`
5. `components/workbench/pyodide-runner.ts`
6. `public/py/dsviz.py`

That is enough to understand both the intended workflow and the shipped architecture without reconstructing the whole history from scratch.
