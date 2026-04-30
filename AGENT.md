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
- `VisListNode`
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
`VisArray` and `VisTreeNode` now follow one shared interaction standard.

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
Known remaining gaps are narrower now:
1. The unified interaction standard exists only for arrays and trees so far.
2. Compact layout values are tuned heuristically and may still need adjustment for extreme traces.
3. Future structures should preserve the current separation between panel resize, internal panning, and wheel zoom instead of inventing per-structure interaction models.

## Collaboration Rules
- Repo-facing docs should stay in English.
- Prefer explicit runtime behavior over hidden magic.
- Preserve ordinary Python shape whenever possible.
- When updating docs, keep them aligned with the actual shipped UI and code, not earlier planning language.
