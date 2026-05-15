# AGENT.md

## Project
**AlgoLens** is a browser-based visual debugger for Python algorithm code. The current v3 state is a working single-page prototype: the user writes Python in the browser, runs `run_case()`, generates a full snapshot trace in worker-isolated Pyodide, and steps through visual state changes in the frontend.

## Current v3 Demo Flow
The shipped v3 flow is:
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
- `VisStack`
- `VisQueue`
- `VisDeque`
- `VisSet`
- `VisHeap`
- `VisMap`
- `VisObject`
- `VisListNode`
- `VisTreeNode`
- `delVis(value)`
- `watch("name", value)`

Notes:
- `VisTreeNode` is the tree abstraction. `VisBST` has been removed from the public surface.
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
  - explicitly call `delVis(...)` on each detached duplicate node
- `Multi Panel`
  - build two independent trees and two independent linked lists
  - verify that each disconnected structure renders in its own panel
- `Nested References`
  - exercise cross-visual nesting, a `Map -> List -> Map` cycle, and a `Map -> List -> Set` chain

Current built-in guides:
- `VisArray`
- `VisArray 2D/3D`
- `VisMap`
- `VisObject`
- `VisStack`
- `VisQueue`
- `VisDeque`
- `VisSet`
- `VisHeap`
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
`VisArray`, `VisMap`, `VisTreeNode`, `VisListNode`, and the new sequence-style structures now follow one shared interaction standard.

Shared rules:
- every structure renders in a floating panel on the canvas
- panel headers drag the whole structure
- drag start should not jump and should not trigger text selection
- panel resize and inner content zoom are separate controls
- individual visual elements are not user-draggable

Array-specific rules:
- defaults should be compact
- long horizontal content should overflow inside the panel rather than forcing unlimited panel growth
- taller 2D and higher-dimensional arrays should open with capped preview heights rather than stretching the outer panel excessively
- array panel resize is non-proportional
- array contents zoom with the mouse wheel
- overflowed array content can be explored by dragging inside the panel body

Tree-specific rules:
- nodes are non-draggable
- the tree viewport pans by dragging empty space
- the tree zooms with the mouse wheel
- tree panel resize changes the outer viewport only and does not rescale the internal content
- tree layout should prefer readable fixed level spacing and avoid subtree overlap
- detached tree components should remain visible while the algorithm is rebuilding or reconnecting them
- outer panel tracking must stay inside the workbench canvas viewport and must not scroll the whole page
- clicking a tree/list reference token must reopen a minimized or closed target panel before focus / track

List-specific rules:
- list nodes are non-draggable
- lists render as pill nodes with obvious arrow edges
- the list viewport uses the same wheel zoom / background pan / manual fit model as trees
- outer panel tracking must stay inside the workbench canvas viewport and must not scroll the whole page
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
Still out of scope for v3:
- auth
- save/share
- backend execution
- Java support
- automatic debugger-style introspection for arbitrary Python state
- production-grade layout polish for every visualization edge case

## Known v3 Gaps
Known remaining gaps are narrower now:
1. The shared panel / reference contract now covers `VisArray`, `VisMap`, and the new sequence-style structures, but still needs to be extended to the remaining visual families.
2. Reference-first nesting should next be extended from `VisMap` and the sequence-style structures to the remaining structures and to future object-like custom panels.
3. `VisObject` now covers the minimal user-facing object-panel flow, but still needs richer controls for field ordering, relabeling, and hiding.
4. Compact layout values are tuned heuristically and may still need adjustment for extreme traces.
5. The frame cap is fixed at 1000 and the worker timeout is fixed at 30 seconds; neither limit has a user-facing control yet.

`delVis(...)` is no longer an open design question.
- default runtime visibility is intentionally conservative
- rewiring or detaching a node does not imply removal
- explicit `delVis(...)` is the supported way for user code to reduce visual noise when a structure is no longer worth showing
- this is preferred over automatic inference because runtime topology changes alone cannot reliably identify algorithmically irrelevant nodes

Nested `VisXxx` design direction is also decided:
- nested visualization should be reference-first, not inline-first
- each `VisXxx` remains a top-level panel owner
- parent structures should render child `VisXxx` values as clickable reference tokens
- clicking a reference token should reuse the same bring-to-front and track behavior as clicking a panel tab
- plain Python containers are not automatically promoted into panels; this mechanism is reserved for explicit `VisXxx` objects
- reference labels should prefer user variable names, with numeric suffixes added only when duplicate names must be disambiguated
- this direction is now implemented through `VisMap` and the sequence-style structures
- this shared reference behavior is intended to become the common contract for future sequence-like, mapping-like, node-like, and object-like `VisXxx` panels

## Collaboration Rules
- Repo-facing docs should stay in English.
- Prefer explicit runtime behavior over hidden magic.
- Preserve ordinary Python shape whenever possible.
- Keep regression coverage for canvas-only tracking math and default array panel sizing aligned with the shipped behavior.
- When updating docs, keep them aligned with the actual shipped UI and code, not earlier planning language.
- When handing off to another agent, mention the current active branch and whether remaining local changes are only cache artifacts.
