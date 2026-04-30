# AGENT.md

## Project
**AlgoLens** is a browser-based visual debugger for Python algorithm code. The current v1 state is a working single-page prototype: the user writes Python in the browser, runs `run_case()`, generates a full snapshot trace in Pyodide, and steps through visual state changes in the frontend.

## Current v1 Demo Flow
The shipped v1 flow is:
1. The user pastes or writes Python code in the Monaco editor.
2. The user defines test input directly inside `run_case()`.
3. The user wraps only the data structures they want to inspect with `dsviz` objects.
4. The platform runs the code in-browser through Pyodide.
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
- `VisTreeNode`
- `watch("name", value)`

Notes:
- `VisTreeNode` is the main tree abstraction now. Earlier references to `VisBST` are outdated for the primary user workflow.
- `watch()` is still explicit. There is no automatic general-purpose local-variable tracing.

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
  - build a tree with at least 9 nodes
  - collect values with inorder traversal into a `VisArray`
  - quicksort the array with explicit swaps
  - rebuild a balanced tree with divide and conquer

Current built-in guides:
- `VisArray`
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

## Trace Model
The frontend is a replay client.

Runtime behavior:
1. Execute the user code in Pyodide.
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
Still out of scope for v1:
- auth
- save/share
- backend execution
- Java support
- automatic debugger-style introspection for arbitrary Python state
- production-grade layout polish for every visualization edge case

## Known v1 Gaps
Known unresolved UI issues:
1. Large arrays can compress until labels become unreadable. Panels need automatic width expansion plus user-controlled proportional scaling.
   - Related bug: `VisArray.append(...)` can update the underlying structure without making the additional array cell visibly appear in the panel.
2. Tree panels need better density control and viewport panning inside the panel when the tree grows.
3. `VisArray` does not yet provide real nested-array rendering or inner-list mutation tracking. Multi-dimensional arrays currently degrade to stringified top-level cells unless values are written back through the outer `VisArray`.
4. Dragging panels currently has rough edges:
   - visible reposition jump at drag start
   - text-selection highlight can appear during drag
   - drag interaction needs smoothing

## Collaboration Rules
- Repo-facing docs should stay in English.
- Prefer explicit runtime behavior over hidden magic.
- Preserve ordinary Python shape whenever possible.
- When updating docs, keep them aligned with the actual shipped UI and code, not earlier planning language.
