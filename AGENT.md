# AGENT.md

## Project
**AlgoLens** is a browser-based visual debugger for Python algorithm code. The current v2 state is a working single-page prototype: the user writes Python in the browser, runs `run_case()`, generates a full snapshot trace in worker-isolated Pyodide, and steps through visual state changes in the frontend.

## Current v2 Demo Flow
The shipped v2 flow is:
1. The user pastes or writes Python code in the Monaco editor.
2. The user defines test input directly inside `run_case()`.
3. The user wraps only the data structures they want to inspect with `dsviz` objects.
4. The platform runs the code in-browser through Pyodide inside a dedicated worker.
5. The run produces a full trace of render-ready frames.
6. The user steps through those frames with `Prev` and `Next`.
7. The editor highlights the currently executing source line for the active frame.

## Product Direction
The intended user flow is:
1. A student has a difficult LeetCode-style problem.
2. Their code runs, but the result is wrong.
3. They paste the code into AlgoLens.
4. They convert only the data structures they want to inspect into `dsviz` objects.
5. The rest of the code should stay as close to ordinary Python as possible.
6. They use the visual trace to identify the bug.

Low-intrusion instrumentation remains the main product constraint. AlgoLens is not trying to replace Python with a DSL.

## User Code Contract
The current execution model is:
- The user writes normal Python.
- The fixed entry point is `run_case()`.
- Inputs are authored directly inside `run_case()` using normal Python code and comments.
- There is no separate input configuration panel in the current UI.

Typical shape:

```python
from dsviz import VisArray, VisTreeNode, watch

class Solution:
    def solve(self, root):
        ...

def run_case():
    root = VisTreeNode(5)
    root.left = VisTreeNode(3)
    root.right = VisTreeNode(8)
    return Solution().solve(root)
```

## Instrumentation Contract
Only explicitly instrumented values are visualized.

Current supported instrumentation:
- `VisArray`
- `VisListNode`
- `VisTreeNode`
- `delVis(value)`
- `watch("name", value)`

Notes:
- `VisTreeNode` is the main tree abstraction now. Earlier references to `VisBST` are outdated for the primary user workflow.
- `watch()` is still explicit. There is no automatic general-purpose local-variable tracing.
- `delVis(value)` is explicit user-controlled removal of an existing visualization and is now part of the public instrumentation surface.

## Current Frontend Structure
The workbench is a single-page split layout with:
- a resizable code editor pane
- a larger visualization pane
- floating `Prev` / `Next` controls
- a floating `Variables` / `Output` sidebar
- draggable visualization panels

Top navigation currently contains:
- `Workbench`
- `Examples`
- `Guides`

`Examples` contains runnable algorithm demos.
`Guides` contains focused usage examples for the individual `dsviz` data structures.

## Current Example Inventory
Current built-in examples:
- `Balanced Rebuild`
  - build an unbalanced BST
  - collect values with inorder traversal into a `VisArray`
  - build a second balanced BST with divide and conquer
  - keep the original unbalanced BST visible while the balanced BST appears in a separate panel
- `Delete Duplicates`
  - remove adjacent duplicates from a sorted linked list in place
- `Multi Panel`
  - build two independent trees and two independent linked lists
  - verify that each disconnected structure renders in its own panel

Current built-in guides:
- `VisArray`
- `VisArray 2D/3D`
- `VisListNode`
- `VisTreeNode`

## Current Rendering Direction
Use:
- `Next.js`
- `Tailwind CSS`
- `Monaco Editor`
- `Pyodide`
- `React Flow`

Rendering split:
- `React Flow` handles tree node / edge rendering
- custom React panels handle arrays
- custom overlay panels handle variables and runtime output

## Current Visualization Standard
`VisArray`, `VisTreeNode`, and `VisListNode` now follow one shared interaction standard.

Shared rules:
- every structure renders in a floating panel on the canvas
- panel headers drag the whole structure
- drag start should not jump and should not trigger text selection
- panel resize and inner content zoom are separate controls
- individual visual elements are not user-draggable

Array-specific rules:
- defaults should be compact
- long horizontal content should overflow inside the panel rather than forcing unlimited panel growth
- array panel resize is non-proportional
- array contents zoom with the mouse wheel
- overflowed array content can be explored by dragging inside the panel body

Tree-specific rules:
- nodes are non-draggable
- the tree viewport pans by dragging empty space
- the tree zooms with the mouse wheel
- tree panel resize remains proportional
- tree layout should prefer readable fixed level spacing and avoid subtree overlap
- detached tree components should remain visible while the algorithm is rebuilding or reconnecting them

List-specific rules:
- list nodes are non-draggable
- lists render as pill nodes with obvious arrow edges
- the list viewport uses the same wheel zoom / background pan / manual fit model as trees
- detached list segments should remain visible during rewiring
- shared-tail list states must not duplicate the same suffix visually

## Trace Model
The frontend is a replay client.

Runtime behavior:
1. Execute the user code in worker-isolated Pyodide.
2. Generate the full trace first.
3. Return render-ready frames to the UI.
4. Step through frames locally in React.

Each frame currently contains:
- `index`
- `label`
- `line`
- `panels`
- `variables`
- `status`
- `stdout`

The `line` field is used to highlight the active source line in Monaco.

## Current Non-Goals
Still out of scope for v2:
- auth
- save/share
- backend execution
- Java support
- automatic debugger-style introspection for arbitrary Python state
- production-grade layout polish for every visualization edge case

## Known v2 Gaps
Known remaining gaps are narrower now:
1. The main visualization canvas still needs its own scrolling model when many panels extend beyond the initial viewport.
2. Panels still need click-to-front behavior so overlapping structures remain accessible.
3. The canvas still needs browser-like panel tabs plus per-panel minimize / close controls, with hidden panels auto-restoring when their structures change again.
4. Compact layout values are tuned heuristically and may still need adjustment for extreme traces.
5. Future structures should preserve the current separation between panel resize, internal panning, and wheel zoom instead of inventing per-structure interaction models.
6. The final semantics of what should happen to in-memory but no-longer-interesting detached nodes are still intentionally conservative; only explicit `delVis(...)` is supported today.
7. The current `Delete Duplicates` example still needs a clean `delVis(...)` demonstration path.
8. Example comments and `delVis(...)` usage examples still need another editing pass for clarity.
9. The frame cap is fixed at 1000 and the worker timeout is fixed at 30 seconds; neither limit has a user-facing control yet.

## Collaboration Rules
- Repo-facing docs should stay in English.
- Prefer explicit runtime behavior over hidden magic.
- Preserve ordinary Python shape whenever possible.
- When updating docs, keep them aligned with the actual shipped UI and code, not earlier planning language.
- When handing off to another agent, mention the current active branch and whether remaining local changes are only cache artifacts.
