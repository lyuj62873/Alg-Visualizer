# AlgoLens v1 Spec

## Goal
AlgoLens v1 is a browser-based Python execution workbench for debugging algorithm code through explicit visualization hooks.

The first successful demo is:
- the user writes Python in the editor
- the user provides input values
- the platform runs `run_case()`
- the run produces a trace
- the user steps through the trace in the browser
- the BST visualization updates frame by frame

## User Code Model
The editor uses two scaffolded sections.

### Solution section
The user writes methods inside:

```python
class Solution:
    ...
```

### Entry section
The user writes:

```python
def run_case():
    ...
```

The platform executes `run_case()` as the fixed entry point.

## Input Model
The platform injects a single `inputs` object into the execution environment.

v1 shape:

```python
inputs = {
    "nums": [5, 3, 8, 4]
}
```

The user decides how to consume and wrap input values.

Example:

```python
def run_case():
    nums = VisArray(inputs["nums"], name="nums")
    sol = Solution()
    return sol.solve(nums)
```

## Instrumentation Model
AlgoLens v1 only visualizes explicitly tracked values.

Supported instrumentation:
- `VisArray`
- `VisBST`
- `watch(name, value)`

Not supported in v1:
- automatic tracking of arbitrary Python locals
- full debugger-style variable inspection
- implicit visualization of standard Python containers

## Scalar Tracking
Scalar tracking uses:

```python
watch("max_val", max_val)
```

Rules:
- `watch(name, value)` records the current scalar value into the active frame
- tracked values are rendered in the `Variables` panel
- the panel shows current state, not a historical log stream
- later frames inherit the previous scalar table and apply updates from the current step

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

## Editor Tracking Action
The editor exposes a `Track variable` action for scalar variables.

Expected behavior:
- the user selects a variable or assignment line
- the user triggers `Track variable`
- the editor inserts a matching `watch("var_name", var_name)` line immediately after the relevant line
- the tracked variable is visually highlighted in the editor

This is editor assistance only. The runtime behavior still comes from explicit `watch(...)` calls in source.

## Trace Contract
The Python runtime returns a trace object with this top-level shape:

```json
{
  "frames": [],
  "panels": [],
  "meta": {}
}
```

### panels
Defines the available visual surfaces for the run.

Example:

```json
[
  {
    "id": "nums",
    "kind": "array",
    "title": "Input Array"
  },
  {
    "id": "bst",
    "kind": "bst",
    "title": "Working BST"
  },
  {
    "id": "variables",
    "kind": "variables",
    "title": "Variables"
  }
]
```

### frames
Each frame is a render-ready snapshot.

Example:

```json
[
  {
    "index": 0,
    "label": "Initialize input",
    "panels": {
      "nums": {
        "values": [5, 3, 8, 4],
        "activeIndices": []
      },
      "bst": {
        "nodes": [],
        "edges": []
      },
      "variables": {
        "items": [
          { "name": "max_val", "value": 0 }
        ]
      }
    }
  }
]
```

Frame rules:
- each frame must be independently renderable
- the frontend should not reconstruct hidden Python state
- `variables.items` is a flat ordered list of name/value pairs
- array and tree panel payloads should already be normalized for rendering

### meta
Execution metadata.

Example:

```json
{
  "status": "ok",
  "stdout": "",
  "result": null,
  "error": null
}
```

v1 statuses:
- `ok`
- `error`

## UI Model
v1 uses a single-page workbench layout with these regions:
- code editor
- input panel
- run/reset controls
- step controls
- visualization area
- status/error area
- compact `Variables` panel in one corner of the visualization region

## Rendering Direction
- use `React Flow` for BST rendering
- use custom React components for arrays
- use a compact list/card view for the `Variables` panel

The frontend is a replay client:
- run first
- receive full trace
- step through frames locally

## Initial Sample Scenario
The first sample should demonstrate:
- an integer input array
- insertion into a BST
- at least one watched scalar such as `i` or `max_val`

This sample is the baseline demo for Week 6.
