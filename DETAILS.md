# AlgoLens Details

This file keeps the heavier implementation notes that were previously crowding the `README`.

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
- `VisStack`
- `VisQueue`
- `VisDeque`
- `VisSet`
- `VisHeap`
- `VisMap`
- `VisObject`
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
- `sort`
- `clear`

`VisArray.sort(...)` follows Python `list.sort(...)` closely, including `key=` and `reverse=`.

### Sequence-Style Containers

Currently supported sequence-style structures:

- `VisStack`
- `VisQueue`
- `VisDeque`
- `VisSet`
- `VisHeap`

Current behavior:

- all five reuse the same sequence-like array panel family
- nested `_VisObject` children render as reference tokens rather than inline expansions
- `VisHeap` intentionally defaults to a list-like / priority-queue style panel instead of a tree-teaching view
- `VisArray`, `VisTreeNode`, and `VisListNode` also render object-valued entries as references instead of flattening them to plain strings

Current structure-specific operations include:

- `VisStack`: `push`, `pop`, `peek`, `clear`
- `VisQueue`: `append`, `popleft`, `peek`, `clear`
- `VisDeque`: `append`, `appendleft`, `pop`, `popleft`, `clear`
- `VisSet`: `add`, `discard`, `remove`, `pop`, `clear`
- `VisHeap`: `heappush`, `heappop`, `peek`, `heapreplace`, `heappushpop`, `heapify`

Expected Python container alignment:

- `VisArray`, `VisStack`, and `VisHeap` wrap list-style values
- `VisQueue` and `VisDeque` wrap `collections.deque`
- `VisSet` wraps `set`
- `VisMap` wraps `dict`

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

### `VisObject`

Currently supports:

- wrapping an ordinary user-defined class instance
- reading public `__dict__` attributes into one top-level panel
- inline scalar attributes
- `VisXxx` attribute references to child panels

Current object-like behavior:

- `VisObject(obj)` reuses the map-style panel family rather than a custom free-form renderer
- panel title can be inferred from the assigned variable name
- panel type label shows the wrapped class name
- private attributes are skipped by default
- `VisObject` does not recursively convert ordinary Python containers inside the object
- users must manually replace the internal fields they want to inspect with `VisXxx` values

Recommended LeetCode-style flow:

1. write the helper class normally
2. replace the internal structures you want to inspect with `VisXxx` values
3. wrap the helper instance with `VisObject(...)` in the driver code
4. inspect one object panel whose child `VisXxx` attributes appear as references to their own panels

### `VisTreeNode`

Currently supports:

- `val`
- `left`
- `right`
- multiple independent tree panels in one run
- node updates through normal attribute assignment
- temporary disconnected tree components staying visible during rebuild workflows

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
- final visibility control is left to user code instead of automatic inference

## Runtime Convenience Layer

The runtime preinjects all `VisXxx` names plus common helpers such as:

- `deque`
- `defaultdict`
- `Counter`
- `heapq`

This keeps the editor closer to a fixed LeetCode-style environment and reduces manual import noise.

## Current Interaction Model

The visualization system follows one shared interaction model across arrays, maps, trees, and lists.

Shared rules:

- every structure renders in a floating panel
- drag the panel header to move the structure
- panel resize changes the outer viewport only
- wheel zoom changes the inner content scale only
- individual nodes or cells are not directly draggable

Array-specific behavior:

- compact default spacing
- non-proportional panel resize
- default panel height is capped for 2D and higher-dimensional arrays
- drag inside the panel body to pan overflowed content

Tree/List-specific behavior:

- internal panning by dragging empty space
- wheel zoom inside the viewport
- manual `Fit`
- default-on `Track` for following the active node within the canvas viewport
- clicking a reference reopens a minimized or closed target panel before bringing it forward

## Built-In Learning Content

Current top-level learning surfaces:

- `User Guide`
- `Examples`
- `Vis API`

Current `Examples`:

- `LCS`
- `Group Anagrams`
- `Path Sum III`
- `LRU Cache`

Current `Vis API` entries:

- `VisArray`
- `VisArray 2D/3D`
- `VisMap`
- `VisObject`
- `VisStack`
- `VisQueue`
- `VisDeque`
- `VisSet`
- `VisHeap`
- `VisTreeNode`
- `VisListNode`
- `watch(...)`
- `delVis(...)`

Current UI behavior:

- `Reset` restores the minimal `class Solution` / `def run_case()` template
- `Run` uses the streamlined green action button
- the `Vis API` dropdown is scrollable so longer API lists stay inside the viewport

## Project Structure

Important files:

- [AGENT.md](AGENT.md)
- [V3-summary.md](V3-summary.md)
- [docs/v3-spec.md](docs/v3-spec.md)
- [components/workbench/canvas-tracking.ts](components/workbench/canvas-tracking.ts)
- [components/workbench/workbench.tsx](components/workbench/workbench.tsx)
- [components/workbench/pyodide-runner.ts](components/workbench/pyodide-runner.ts)
- [public/py/dsviz.py](public/py/dsviz.py)
- [tests/test_dsviz_array_sizing.py](tests/test_dsviz_array_sizing.py)

If you are continuing development, start with `V3-summary.md` first.

## Planned Follow-Up

These are the remaining follow-up items that still look real instead of abandoned:

- extend `VisObject` with richer field controls such as ordering, relabeling, and hiding
- keep tuning compact layout defaults for very large or unusual traces
- consider a lighter editor-assisted workflow for inserting `watch(...)`
- consider whether the fixed 1000-frame cap and 30-second timeout should become configurable

## Deferred Explorations

The following ideas were discussed but are intentionally not active implementation targets right now:

- an editor gutter "eye" workflow that rewrites selected assignments into `VisXxx`
- a two-pass runtime-assisted rewrite flow that first learns runtime types, then rewrites marked lines for a second run

These stay deferred because the current product model visualizes explicit object instances rather than variable names, so rebinding and later type changes can diverge from user expectations.
