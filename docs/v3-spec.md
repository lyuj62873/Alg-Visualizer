# AlgoLens v3 Spec

## Goal
AlgoLens v3 is a browser-based Python execution workbench for debugging algorithm code through explicit visualization hooks.

The current successful demo path is:
- the user writes Python in the editor
- the user defines input inside `run_case()`
- the platform runs `run_case()`
- the run produces a full trace
- the user steps through the trace in the browser
- the editor highlights the active line for the current frame
- tree and array visualizations update frame by frame

Execution safety rules in the current implementation:
- user code runs inside a dedicated worker-backed Pyodide runtime
- trace generation stops once the run reaches 1000 visualization frames
- worker execution stops once a run reaches 30 seconds
- frame-cap failures should surface as runtime execution errors instead of freezing the page
- timeout failures should surface as runtime execution errors instead of freezing the page

## User Code Model
The editor is a single Python file.

Expected code structure:

```python
class Solution:
    ...

def run_case():
    ...
```

Rules:
- `run_case()` is the fixed entry point
- user inputs are authored directly in code
- users wrap only the structures they want to inspect
- ordinary Python values that are not wrapped remain non-visual

## Input Model
There is no separate input config UI in the current v3 implementation.

Users define their test input directly inside `run_case()`.

Example:

```python
def run_case():
    root = VisTreeNode(5)
    root.left = VisTreeNode(3)
    root.right = VisTreeNode(8)
    return Solution().solve(root)
```

## Instrumentation Model
AlgoLens v3 visualizes only explicitly tracked values.

Current supported primitives:
- `VisArray`
- `VisMap`
- `VisListNode`
- `VisTreeNode`
- `delVis(value)`
- `watch(name, value)`

Notes:
- `VisTreeNode` is the primary tree abstraction for LeetCode-style usage
- `VisBST` still exists in `dsviz.py`, but it is not the main user-facing path
- normal Python containers are not visualized unless the user converts them
- `delVis(value)` is an explicit user call that removes an existing visualization

## Scalar Tracking
Scalar tracking uses:

```python
watch("max_val", max_val)
```

Rules:
- `watch(name, value)` records the current value under a stable name
- tracked values are shown in the `Variables` panel
- the panel shows current snapshot state, not a raw append-only log
- a new frame is emitted when the watched value changes

## Editor Highlighting
The active Monaco editor line is synchronized with the current trace frame.

Current behavior:
- runtime frames include a `line` field
- Pyodide uses `sys.settrace` for user-code line events inside the worker runtime
- Monaco applies a whole-line decoration for the active frame

This is for orientation only. It does not make AlgoLens a full debugger.

## Trace Contract
The Python runtime returns:

```json
{
  "frames": []
}
```

Each frame is render-ready and currently has this shape:

```json
{
  "index": 0,
  "label": "array.append(4)",
  "line": 12,
  "panels": [],
  "variables": [
    { "name": "i", "value": "2" }
  ],
  "status": "array.append(4)",
  "stdout": ""
}
```

Frame rules:
- each frame must be independently renderable
- the frontend should not reconstruct hidden Python state
- `panels` already contain normalized display payloads
- `line` may be `null` when unavailable

## Panel Model
Current visual panel kinds:
- `array`
- `bst`
- `list`

Notes:
- `bst` is the frontend panel kind used for tree rendering, including `VisTreeNode`
- `list` is the frontend panel kind used for `VisListNode`
- the frontend uses one large visualization canvas that contains multiple draggable panels

## Unified Visualization Scheme
Array, tree, and list panels now follow one shared interaction model with structure-specific rendering rules.

Shared panel rules:
- each visualized structure renders inside a floating panel on the main canvas
- panels can be dragged by the header to reposition the whole structure
- panel dragging must not cause a visible jump at drag start
- panel dragging must suppress accidental text selection
- panel contents are not directly editable from the canvas
- individual elements inside a structure are not user-draggable

Shared density rules:
- default layouts should be compact before any user adjustment
- spacing between visible elements should stay as tight as readability allows
- the outer panel size and the inner content scale are controlled independently

Shared zoom / resize rules:
- panel resize changes the outer viewport only
- content zoom changes the inner visualization scale only
- resize should not implicitly rescale the internal content
- wheel interaction is reserved for content zoom inside the panel

### Array Rendering Rules
`VisArray` panels use custom React rendering rather than a node graph.

Current array behavior:
- array cells use tight padding and compact gaps by default
- panel width has a maximum bound so long arrays stop growing horizontally after a point
- overflow is handled inside the panel instead of by infinite outer expansion
- the user can drag inside the array panel to pan across overflowed content
- the user can zoom array contents with the mouse wheel
- resizing an array panel is non-proportional so width and height can be adjusted independently

Supported array layouts:
- 1D arrays render as a compact horizontal row
- 2D arrays render as a matrix with row indices
- 3D and deeper arrays render as stacked slices
- nested array mutations emit frames without requiring write-back through the outer container

### Tree Rendering Rules
`VisTreeNode` panels use `React Flow` as the viewport and edge renderer.

Current tree behavior:
- tree nodes are compact and non-draggable
- edges are derived from the traced tree structure and stay attached automatically
- the user can pan the tree viewport by dragging empty space inside the panel
- the user can zoom the tree with the mouse wheel
- tree panel resize remains proportional so the viewport grows and shrinks as one surface
- disconnected tree components remain visible when algorithms temporarily split the structure
- `Fit` is manual
- `Track` is default-on and follows the active node without hard recenters on every frame

Current tree layout rules:
- vertical level spacing is fixed and readable
- horizontal placement is computed from full binary-tree level slots rather than local subtree compression
- larger trees expand their internal layout space instead of overlapping lower levels
- routine panel resizing should not reset the user's manual viewport exploration

### List Rendering Rules
`VisListNode` panels also use `React Flow`, but list rendering differs from tree rendering.

Current list behavior:
- nodes render as pills with explicit arrow edges
- nodes are non-draggable
- the user can pan the viewport by dragging empty space
- the user can zoom with the mouse wheel
- `Fit` is manual
- `Track` is default-on and follows the active node using bounded viewport movement
- disconnected list segments remain visible during rewiring
- shared-tail list states render as one shared suffix rather than duplicated chains

## Planned Nested `VisXxx` References

Future container structures should support nesting through panel references rather than automatic inline expansion.

Specification direction:
- every explicit `VisXxx` object remains the owner of its own top-level panel
- when a `VisXxx` object is stored inside another `VisXxx`, the parent panel should render a reference token to the child instead of embedding a second full rendering of the child
- clicking the reference token should invoke the same focus behavior as clicking the child's tab:
  - bring the child panel to the front
  - track the outer canvas to the child panel
- plain Python values may still render inline according to the parent structure's own display rules
- plain Python containers are not automatically promoted into panels; this nested reference system is reserved for explicit `VisXxx` objects
- if a child visualization is removed with `delVis(child)`, parent references to that child should degrade into non-clickable summaries

Reference labeling direction:
- prefer inferred variable names when available
- if multiple visible objects share the same inferred name, disambiguate them with numeric suffixes
- preserve semantically meaningful user names such as `head` and `tail` whenever possible

Current implementation status:
- the reference-first model is now implemented for `VisMap`
- map entries may render child `VisXxx` values as clickable reference tokens
- clicking a token reuses the same bring-to-front and canvas-track behavior as a panel tab
- `delVis(child)` degrades those map references into non-clickable summaries

## UI Model
The current single-page workbench contains:
- a code editor pane
- a visualization pane
- floating step controls
- a floating `Variables` and `Output` sidebar
- top-level `Examples` and `Guides` menus

Current built-in `Examples`:
- `Balanced Rebuild`
- `Delete Duplicates`
- `Multi Panel`

Current built-in `Guides`:
- `VisArray`
- `VisArray 2D/3D`
- `VisMap`
- `VisListNode`
- `VisTreeNode`

## Rendering Direction
- use `React Flow` for tree rendering
- use custom React components for arrays
- use Monaco decorations for active-line highlighting
- keep the frontend as a replay client, not a live execution engine

## Error Handling
Runtime failures are surfaced in a dedicated error card in the output sidebar.

Current error payload includes:
- error type
- message
- traceback
- line number when available

Additional failure mode:
- frame-cap termination when user code generates more than 1000 visualization frames
- worker timeout termination when user code does not finish within 30 seconds

## Known Limitations
Current unresolved limitations:
1. Compact defaults have been tuned manually and may need further calibration for very large traces or unusual value lengths.
2. Array, tree, and list interaction rules are now stable, but future structures should reuse the same separation between panel resize, content zoom, and internal panning where appropriate.
3. Automatic garbage-collection-like hiding of detached nodes is intentionally not implemented; explicit `delVis(...)` is the supported removal path.
4. The visualization frame cap is fixed at 1000 and the worker timeout is fixed at 30 seconds; neither limit is configurable from the UI.

This is a product decision rather than a temporary gap:
- topology changes alone are not enough to infer when a node has become semantically irrelevant
- list cleanup and tree rebuild flows need different visibility choices even when the runtime sees similar pointer changes
- final visibility control is therefore left to user code via `delVis(...)`

These are post-v3 polish items, not blockers for the current prototype.
