# AlgoLens v1 Spec

## Goal
AlgoLens v1 is a browser-based Python execution workbench for debugging algorithm code through explicit visualization hooks.

The current successful demo path is:
- the user writes Python in the editor
- the user defines input inside `run_case()`
- the platform runs `run_case()`
- the run produces a full trace
- the user steps through the trace in the browser
- the editor highlights the active line for the current frame
- tree and array visualizations update frame by frame

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
There is no separate input config UI in the current v1 implementation.

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
AlgoLens v1 visualizes only explicitly tracked values.

Current supported primitives:
- `VisArray`
- `VisTreeNode`
- `watch(name, value)`

Notes:
- `VisTreeNode` is the primary tree abstraction for LeetCode-style usage
- `VisBST` still exists in `dsviz.py`, but it is not the main user-facing path
- normal Python containers are not visualized unless the user converts them

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
- Pyodide uses `sys.settrace` for user-code line events
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

Notes:
- `bst` is the frontend panel kind used for tree rendering, including `VisTreeNode`
- the frontend uses one large visualization canvas that contains multiple draggable panels

## Unified Visualization Scheme
Array and tree panels now follow one shared interaction model with structure-specific rendering rules.

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

Current tree layout rules:
- vertical level spacing is fixed and readable
- horizontal placement is computed from full binary-tree level slots rather than local subtree compression
- larger trees expand their internal layout space instead of overlapping lower levels
- the visible tree is auto-fit when the traced layout changes, but routine panel resizing should not reset the user's manual viewport exploration

## UI Model
The current single-page workbench contains:
- a code editor pane
- a visualization pane
- floating step controls
- a floating `Variables` and `Output` sidebar
- top-level `Examples` and `Guides` menus

Current built-in `Examples`:
- `Balanced Rebuild`

Current built-in `Guides`:
- `VisArray`
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

## Known Limitations
Current unresolved limitations:
1. The current visual system is tuned only for arrays and trees.
2. Compact defaults have been tuned manually and may need further calibration for very large traces or unusual value lengths.
3. Array and tree interaction rules are now stable, but future structures should reuse the same separation between panel resize, content zoom, and internal panning where appropriate.

These are post-v1 polish items, not blockers for the current prototype.
