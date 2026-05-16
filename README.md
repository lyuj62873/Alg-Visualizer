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
- `VisStack`
- `VisQueue`
- `VisDeque`
- `VisSet`
- `VisHeap`
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
- `VisArray`, `VisTreeNode`, and `VisListNode` now also render object-valued entries as references instead of flattening them to plain strings

Current structure-specific operations include:
- `VisStack`: `push`, `pop`, `peek`, `clear`
- `VisQueue`: `append`, `popleft`, `peek`, `clear`
- `VisDeque`: `append`, `appendleft`, `pop`, `popleft`, `clear`
- `VisSet`: `add`, `discard`, `remove`, `pop`, `clear`
- `VisHeap`: `heappush`, `heappop`, `peek`, `heapreplace`, `heappushpop`, `heapify`

Current Python-native polish:
- `VisArray.sort(...)` now follows Python `list.sort(...)` closely, including `key=` and `reverse=`
- the runtime now preinjects all `VisXxx` names plus common helpers such as `deque`, `defaultdict`, `Counter`, and `heapq`, so users do not have to add those imports manually

Expected Python container alignment:
- `VisArray`, `VisStack`, and `VisHeap` are meant to wrap list-style values
- `VisQueue` and `VisDeque` are meant to wrap `collections.deque`
- `VisSet` is meant to wrap `set`
- `VisMap` is meant to wrap `dict`

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

Example:
- `public/examples/vis-object-example.py` shows `MyQueue` implemented with two `VisStack` objects and one wrapping `VisObject(queue)`

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

The current prototype is already usable, but several follow-up areas remain:
- continue extending the shared panel / reference contract from `VisArray`, `VisMap`, and the new sequence-style structures to the remaining visual families
- expand the reference-first nested container model from `VisMap` and the new sequence-style structures to the remaining structures after that shared contract is in place
- add an object-like custom visualization panel for user-defined LeetCode helper classes whose attributes may point at other `VisXxx` panels
- extend the minimal `VisObject` wrapper into a richer object-panel API with optional field ordering, relabeling, and hiding controls
- keep tuning compact layout defaults for large or unusual traces
- extend the same interaction model to future structures
- discuss feasibility first, then consider an editor gutter "eye" workflow that lets users click an assignment line number to request assisted visualization insertion
- the most promising version discussed so far is a two-pass flow: first run the original code to learn runtime types on marked lines, then rewrite only those marked assignments into `VisXxx` constructions or `VisObject(...)` wrappers for a second run
- this is intentionally deferred for now because the product currently visualizes explicit object instances rather than variable names, and variable rebinding or later type changes could make an auto-rewritten second run diverge from what users think they marked
- if revisited later, the feature should remain opt-in, limited to narrow assignment forms, and explicit about conservative fallbacks for ambiguous Python containers such as `list` and `deque`
- the in-page learning content is now split into four clear surfaces:
  - a minimal default editor template with short pointers to `User Guide`, `Examples`, and `Vis API`
  - `User Guide` for workflow, page controls, panel interactions, and the current explicit `VisXxx` mental model
  - `Examples` for complete problem-oriented demos such as `LCS`, `Group Anagrams`, `Path Sum III`, and `LRU Cache`
  - `Vis API` as the per-class usage reference
- `Reset` now restores only the minimal skeleton template instead of an old runnable example
- the Python-native convenience layer is in place:
  - `VisArray.sort(key=..., reverse=...)` follows Python `list.sort(...)`
  - all visualization classes and common container helpers are preinjected so the editor behaves more like a fixed LeetCode-style environment
- rewrite the user guide so panel controls, examples, `watch(...)`, `delVis(...)`, and each public `VisXxx` API are all documented in one coherent flow
- consider editor-assisted help for inserting `watch(...)`
- consider whether the fixed 1000-frame cap and 30-second timeout should become configurable

### Planned Nested Container Rule

For container-style structures such as `VisMap`, `VisSet`, `VisQueue`, `VisStack`, `VisDeque`, `VisHeap`, and `VisObject`, nested visualization should default to references rather than duplicated inline rendering.

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

### Planned Shared Panel Contract

The long-term direction is to unify every `VisXxx` object under one panel / reference contract even when their rendered bodies differ.

Planned shared behavior:
- every `VisXxx` owns a stable panel identity, title, type label, sizing hints, focus state, and reference behavior
- parent panels may expose child `VisXxx` objects only through reference tokens
- scalar values still render inline according to the parent structure's own display rules
- render families may differ even when the panel contract is shared:
  - sequence-like structures such as `VisArray`, `VisStack`, `VisQueue`, `VisDeque`, `VisSet`, and default `VisHeap`
  - mapping-like structures such as `VisMap`
  - node-like structures such as `VisTreeNode`
  - object-like panels such as `VisObject`

### Current Custom Object Panels

The intended custom-class workflow is now live in minimal form through `VisObject(...)`.

Current behavior:
- a user-defined object gets its own top-level panel
- plain attributes render inline
- attributes that point at `VisXxx` values render as reference tokens to those child panels
- the result behaves like an object view or `VisMap`-style attribute table, not a free-form renderer

## Non-Goals For Now

Still out of scope for the current prototype:
- backend execution
- authentication
- save/share flows
- Java support
- automatic visualization of arbitrary Python state without explicit instrumentation
