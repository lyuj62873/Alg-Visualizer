# AGENT.md

## Project
**AlgoLens** is a browser-based data structure visual debugger for Python algorithm code. The primary v1 goal is a stable end-to-end demo for Week 6: a user writes Python code, configures input, runs it in the browser, and steps through visual state snapshots.

## v1 Goal
Build a working technical prototype, not a polished product.

The required v1 demo flow is:
1. The user writes or pastes Python code into the editor.
2. The user provides input values in the input area.
3. The platform runs the code through Pyodide.
4. The run produces a trace of snapshots.
5. The user steps through the snapshots in the browser.
6. At minimum, a BST visualization works reliably.

## Product Direction
The intended use case is:
1. A student has a difficult LeetCode-style problem.
2. Their code runs, but the result is wrong.
3. They paste the code into AlgoLens.
4. They convert only the data structures they want to inspect into `dsviz` objects.
5. The rest of the code should remain as unchanged as possible.
6. They use step-by-step visualization to find the bug.

Low-intrusion instrumentation is a core constraint. The platform should not require the user to rewrite the algorithm into a custom DSL.

## User Code Contract
v1 uses a scaffolded two-part editor model:

- `Solution` section:
  The user writes their algorithm methods inside a `Solution` class.
- `run_case()` section:
  The user constructs input, wraps chosen values with `dsviz` objects, creates a `Solution()` instance, and calls the method they want to test.

The platform executes `run_case()` as the fixed entry point.

The platform should guide the user with comments in the scaffold, but the code remains standard Python.

## Visualization Contract
AlgoLens v1 is not a general-purpose Python debugger.

Only explicitly instrumented objects are visualized:
- Data structures created through `dsviz`
- Scalar variables explicitly tracked through `watch(name, value)`

The trace should be generated as a structured snapshot sequence and sent to the frontend as a JSON-like object with:
- `frames`
- `panels`
- `meta`

The frontend is a replay client, not a live debugger. The full trace is generated first, then the UI steps through frames.

## Initial dsviz Scope
The first `dsviz` components are:
- `VisArray`
- `VisBST`

These are the required starting targets because they cover:
- visible input data
- a tree structure with meaningful step-by-step growth

Future structures can be added later without changing the overall architecture.

## Scalar Tracking
Scalar tracking uses:
- `watch("name", value)`

This is intentionally explicit. v1 does not attempt automatic tracking of arbitrary Python variables.

Expected behavior:
- `watch()` records the current value of a named variable into the trace
- tracked scalar values are shown in a dedicated `Variables` panel
- the panel is displayed as a compact name/value list in one corner of the visualization area
- frame state should behave like a current snapshot, not a raw log dump

Example:

```python
max_val = 0
watch("max_val", max_val)

for i in range(len(nums)):
    watch("i", i)
    if nums[i] > max_val:
        max_val = nums[i]
        watch("max_val", max_val)
```

## Editor UX for Tracking
The editor should support a lightweight tracking action for scalars.

Preferred v1 behavior:
- The user selects a variable or assignment line.
- The user triggers a `Track variable` editor action.
- The platform inserts a matching `watch("var_name", var_name)` line in the appropriate next line position.
- The tracked variable is visually highlighted in the editor.

Important:
- The real source of truth is still the inserted `watch(...)` line.
- Highlighting is an editor enhancement, not hidden runtime magic.
- Avoid automatic rewrites that change Python semantics.

## Frontend Framework Direction
Use:
- `Next.js`
- `Tailwind CSS`
- `Monaco Editor`
- `Pyodide`
- `React Flow`

Framework split:
- `React Flow` handles tree/graph-style visualizations
- custom React panels handle arrays, variables, status, and lightweight side content

Do not replace `React Flow` with a fully custom graph renderer in v1 unless it becomes a blocking issue.

## UI Direction
v1 uses a **single-page workbench** layout.

The main regions are:
- code editor
- input configuration
- run/reset controls
- step controls
- visualization area
- status/error area
- compact `Variables` panel

The experience should prioritize clarity for debugging over visual polish.

## Figma Workflow
All markdown/spec/project docs should be written in English.
Conversation with the user may be in Chinese.

Figma is used in v1 for low-fidelity planning, not final polish.

Required Figma work:
- one main single-page workbench screen
- at least three states:
  - idle
  - ready after successful run
  - error after failed execution

Figma should lock:
- information hierarchy
- panel placement
- basic interaction flow

Do not spend v1 time on high-fidelity branding work before the technical prototype is stable.

## Engineering Priorities
Priority order:
1. Project scaffold
2. Pyodide execution
3. Trace generation contract
4. `VisBST`
5. stepping UI
6. `VisArray`
7. scalar `watch()` + `Variables` panel
8. editor tracking action

If time becomes tight, preserve the end-to-end BST flow first.

## Non-Goals for v1
Do not treat these as required for the Week 6 build:
- auth
- persistence or sharing
- generic debugger support for arbitrary Python locals
- backend execution
- Java support
- polished visual design system

## Collaboration Rules
- Documentation and repo-facing specs should be written in English.
- Keep implementation decisions aligned with the low-intrusion user workflow.
- Do not expand scope before the BST demo path is stable.
- Prefer explicit, inspectable behavior over hidden automation.
- Preserve user code shape whenever possible.
