# AlgoLens V3 Summary

## Purpose
This document is the fastest way for a new agent to understand the current state of the repo after the v3 implementation pass.

Use this together with:
- `AGENT.md`
- `docs/v3-spec.md`
- `PROJECT_PROPOSAL.md`

Those files describe the intended product direction. This file describes what was actually built, what changed during implementation, and what is still unresolved.

## Current Product State
AlgoLens v3 is a working browser-based Python visualization workbench.

Implemented end-to-end flow:
1. The user writes Python code in Monaco.
2. The user defines input directly inside `run_case()`.
3. The code runs in worker-isolated Pyodide in the browser.
4. `dsviz` emits a full trace of render-ready frames.
5. The frontend replays those frames with `Prev` and `Next`.
6. The editor highlights the currently executing line for the active frame.
7. Visualized arrays, maps, linked lists, trees, watched scalars, and runtime errors all update with frame changes.

## This Week's Summary
This week focused on stabilizing the visual interaction model and expanding the supported data structures.

Main outcomes:
- `VisArray` was upgraded from simple 1D rendering to full multidimensional list visualization.
- `VisMap` now exists as the first reference-first nested container, with clickable child `VisXxx` references.
- `VisTreeNode` interaction and layout were tightened until the default tree view became compact, navigable, and readable.
- `VisListNode` was added as a first-class visualization primitive with arrow-based linked-list rendering.
- detached list and tree components remain visible during rewiring and rebuild algorithms instead of disappearing until they reconnect.
- node panels now use manual `Fit` plus default-on `Track` instead of unconditional auto-recenter.
- `delVis(...)` was added so user code can explicitly remove an existing visualization.

The repo is now at the point where array, map, tree, and list visualizations all exist and share a mostly unified panel model.

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
- top nav now contains `Examples` and `Guides`
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
- worker-backed execution isolation with a 1000-frame visualization cap and a 30-second timeout fallback
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
- `VisListNode`
- `VisTreeNode`
- `delVis(value)`
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

`VisListNode` supports:
- `val`
- `right`
- change tracking through `__setattr__`
- list-style node/arrow rendering rather than tree layout

`delVis(value)` currently supports:
- `VisArray`
- `VisTreeNode`
- `VisListNode`

Current `delVis` semantics:
- deleting a `VisArray` removes the whole array panel
- deleting a `VisTreeNode` / `VisListNode` removes that node from visualization
- if that node was the final node in its panel, the whole panel disappears
- deleted objects stop emitting future visualization updates
- rewiring a node out of a list or tree does not hide it automatically; explicit `delVis(...)` is the supported removal path for detached but still in-memory objects
- this is an intentional user-control mechanism, not a missing auto-cleanup feature
- the runtime does not attempt to infer whether a detached node is still algorithmically relevant
- this keeps behavior predictable across cases like duplicate-node cleanup in lists versus temporary detach-and-reconnect workflows in trees

Relevant file:
- `public/py/dsviz.py`

### Unified panel interaction model
The visualization system now follows one shared interaction model across arrays and node-based structures.

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
- default panel height is capped for 2D and higher-dimensional arrays so larger nested content stays inside an internal scrollable viewport
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
- disconnected tree components remain visible during rebuild / detach operations
- `Fit` is manual
- `Track` is default-on and follows the active node without forcibly recentering every frame
- outer panel tracking stays inside the workbench canvas viewport instead of scrolling the whole page

Relevant files:
- `public/py/dsviz.py`
- `components/workbench/tree-flow.tsx`
- `components/workbench/results-pane.tsx`

### `VisListNode` rendering direction
`VisListNode` reuses the node viewport stack, but renders as a linked list instead of a tree.

Current behavior:
- nodes are rendered as pills with explicit arrows
- nodes are non-draggable
- background drag pans the internal viewport
- wheel zoom changes internal scale
- `Fit` is manual
- `Track` is default-on and follows the active node with bounded viewport shifts
- outer panel tracking stays inside the workbench canvas viewport instead of scrolling the whole page
- disconnected list segments remain visible during rewiring
- shared-tail list states are rendered without duplicating the same suffix chain twice

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
- `Guides -> VisArray 2D/3D`
- `Guides -> VisMap`
- `Guides -> VisListNode`
- `Guides -> VisTreeNode`
- `Examples -> Balanced Rebuild`
- `Examples -> Delete Duplicates`
- `Examples -> Multi Panel`

The `Balanced Rebuild` example demonstrates:
1. build an unbalanced BST
2. collect values by inorder traversal into `VisArray`
3. build a second balanced BST by divide and conquer
4. keep both trees visible in separate panels during replay

Relevant files:
- `public/examples/vis-array-example.py`
- `public/examples/vis-array-multidim-example.py`
- `public/examples/vis-list-node-example.py`
- `public/examples/vis-tree-node-example.py`
- `public/examples/balanced-rebuild-example.py`
- `public/examples/delete-duplicates-example.py`

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
- `VisListNode` example runs
- `Balanced Rebuild` runs and emits a large trace
- `Delete Duplicates` runs and emits a linked-list trace
- canvas-only panel tracking math is covered by `Vitest`
- default array panel height rules for 2D / 3D / higher-dimensional arrays are covered by Python `unittest`
- TypeScript type check passes
- `npm run test` passes locally
- `next build` passes locally after the `next` upgrade
- built-in examples load from the navbar menus
- active-line highlighting changes when stepping frames
- list rewiring was manually inspected in browser screenshots after the shared-tail layout fix

Relevant regression test files:
- `components/workbench/canvas-tracking.test.ts`
- `tests/test_dsviz_array_sizing.py`

## Current Visualization Standard
The repo now has a usable default standard for visual structures:
1. elements should start compact rather than spacious
2. the outer panel is a viewport and can be resized independently
3. inner content scale is controlled by wheel zoom, not by panel resize
4. the user moves the whole structure by dragging the panel
5. the user may pan inside the panel when the structure overflows its viewport
6. single visual elements are not draggable

This standard is now implemented for `VisArray`, `VisMap`, `VisTreeNode`, and `VisListNode` and should be reused for future structures.

## Planned Nested `VisXxx` References

Nested container visualization should default to cross-panel references rather than inline duplication.

Current implementation status:
- this is now live for `VisMap`
- child `VisXxx` values render as clickable reference tokens inside the map panel
- `delVis(child)` degrades those references into non-clickable summaries

Decision:
- each `VisXxx` object owns its own panel
- if a `VisXxx` object is stored inside another `VisXxx`, the parent should render a clickable reference token instead of embedding a second full copy of the child structure
- clicking that token should reuse the same bring-to-front and canvas-track behavior as clicking the child's tab
- plain Python values still render inline; only explicit `VisXxx` objects participate in this panel reference system
- if `delVis(child)` removes a child visualization, parent references should degrade to non-clickable summaries instead of leaving broken navigation

Reference naming rule:
- prefer the inferred variable name when available
- if repeated names collide, preserve meaningful names and disambiguate duplicates with numeric suffixes such as `node1`, `node2`, ...
- this is intended to preserve user-authored names like `head` and `tail` while still distinguishing loop-created repeated names

## Remaining Follow-Up
The old drag / resize blockers are no longer the main TODOs. Remaining work is now narrower and more product-shaping.

Current unfinished TODOs:
1. extend the reference-first nested container model from `VisMap` to future structures such as `VisSet`, `VisQueue`, `VisStack`, and `VisHeap`
2. further tune compact layout defaults for extreme traces, long labels, and unusual density
3. revisit an editor-assisted `watch(...)` insertion workflow if low-intrusion UX is still desired
4. consider whether the current fixed 1000-frame cap and 30-second timeout should become configurable per run or per environment

These TODOs are the right next-agent starting point before any new broad feature branch.

## Local Repo State Notes
At the end of this week:
- the current default branch is `main`
- the local working tree may still contain only Python cache folders such as `public/py/__pycache__/` or `public/examples/__pycache__/`
- bug-investigation screenshots were intentionally deleted and should not be considered part of project state

## Fast Start For A New Agent
If a new agent needs to continue this repo, the most useful reading order is:
1. `V3-summary.md`
2. `AGENT.md`
3. `docs/v3-spec.md`
4. `components/workbench/workbench.tsx`
5. `components/workbench/pyodide-runner.ts`
6. `public/py/dsviz.py`

That is enough to understand both the intended workflow and the shipped architecture without reconstructing the whole history from scratch.
