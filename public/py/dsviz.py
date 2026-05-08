from __future__ import annotations

import ast
from collections import OrderedDict
from dataclasses import dataclass
import inspect
import linecache
from typing import Any, Dict, List, Optional, Tuple

MAX_TRACE_FRAMES = 1000


class VisualizationFrameLimitExceededError(Exception):
    pass


def _safe_str(value: Any) -> str:
    try:
        return str(value)
    except Exception:
        try:
            return repr(value)
        except Exception:
            return "<unprintable>"


@dataclass
class _PanelLayout:
    x: float
    y: float
    width: float
    height: float
    scale: float


@dataclass
class _DynamicPanelState:
    panel_id: str
    title: str
    layout: _PanelLayout
    node_ids: set


class _TraceState:
    def __init__(self) -> None:
        self._variables: "OrderedDict[str, str]" = OrderedDict()
        self._objects: List["_VisObject"] = []
        self._frames: List[Dict[str, Any]] = []
        self._frame_counter = 0
        self._last_touched: Optional[str] = None
        self._current_line: Optional[int] = None

    def reset(self) -> None:
        self._variables.clear()
        self._objects.clear()
        self._frames.clear()
        self._frame_counter = 0
        self._last_touched = None
        self._current_line = None

    def register_object(self, obj: "_VisObject") -> None:
        if obj not in self._objects:
            self._objects.append(obj)

    def unregister_object(self, obj: "_VisObject") -> bool:
        if obj not in self._objects:
            return False
        self._objects.remove(obj)
        return True

    def watch(self, name: str, value: Any) -> None:
        # Keep insertion order stable and emit a frame when the value changes.
        next_value = _safe_str(value)
        prev_value = self._variables.get(name)
        self._variables[name] = next_value
        if prev_value != next_value:
            self.emit(label=f"watch({name})")

    def emit(self, label: str, status: str = "", stdout: str = "") -> None:
        if self._frame_counter >= MAX_TRACE_FRAMES:
            raise VisualizationFrameLimitExceededError(
                f"Visualization frame limit exceeded ({MAX_TRACE_FRAMES}). "
                "Please reduce unnecessary visualization or use a smaller debug case."
            )
        panels: List[Dict[str, Any]] = []
        for obj in self._objects:
            rendered = obj._render_panel()
            if isinstance(rendered, list):
                panels.extend(rendered)
            else:
                panels.append(rendered)
        variables = [{"name": k, "value": v} for k, v in self._variables.items()]
        frame = {
            "index": self._frame_counter,
            "label": label,
            "line": self._current_line,
            "panels": panels,
            "variables": variables,
            "status": status or label,
            "stdout": stdout,
        }
        self._frames.append(frame)
        self._frame_counter += 1

    def touch(self, object_id: str) -> None:
        self._last_touched = object_id

    def set_current_location(self, line: Optional[int]) -> None:
        self._current_line = line

    def suggest_panel_layout(
        self,
        *,
        preferred_x: float,
        preferred_y: float,
        width: float,
        height: float,
        scale: float,
        padding: float = 3.0,
    ) -> _PanelLayout:
        candidates = [
            (preferred_x, preferred_y),
            (preferred_x, preferred_y + 20.0),
            (preferred_x, preferred_y + 40.0),
            (preferred_x, preferred_y + 60.0),
            (preferred_x + 8.0, preferred_y + 20.0),
            (preferred_x + 8.0, preferred_y + 40.0),
        ]

        def overlaps(x: float, y: float) -> bool:
            left = x - padding
            top = y - padding
            right = x + width + padding
            bottom = y + height + padding
            for obj in self._objects:
                other = obj.layout
                if right <= other.x or left >= other.x + other.width:
                    continue
                if bottom <= other.y or top >= other.y + other.height:
                    continue
                return True
            return False

        for x, y in candidates:
            if not overlaps(x, y):
                return _PanelLayout(x=x, y=y, width=width, height=height, scale=scale)

        return _PanelLayout(
            x=preferred_x,
            y=preferred_y + (len(self._objects) * 18.0),
            width=width,
            height=height,
            scale=scale,
        )

    @property
    def last_touched(self) -> Optional[str]:
        return self._last_touched

    def export_frames(self) -> List[Dict[str, Any]]:
        # Normalize indices and keep a deep-ish copy so user code can't mutate exports.
        frames: List[Dict[str, Any]] = []
        for idx, frame in enumerate(self._frames):
            cloned = dict(frame)
            cloned["index"] = idx
            frames.append(cloned)
        return frames


_TRACE = _TraceState()


def reset_trace() -> None:
    _TRACE.reset()
    # Ensure singleton panels and counters don't leak across runs when users call reset_trace()
    # in a long-lived interpreter (e.g. local Python, notebooks).
    global _TREE_PANEL
    global _LIST_PANEL
    _TREE_PANEL = None
    _LIST_PANEL = None
    # Best-effort counter reset (module might not have loaded these symbols yet).
    try:
        _VisObject._id_counter = 0
    except Exception:
        pass
    try:
        globals().get("VisTreeNode")._node_counter = 0  # type: ignore[union-attr]
    except Exception:
        pass
    try:
        globals().get("VisListNode")._node_counter = 0  # type: ignore[union-attr]
    except Exception:
        pass


def watch(name: str, value: Any) -> None:
    _TRACE.watch(name, value)


def emit(label: str, status: str = "", stdout: str = "") -> None:
    _TRACE.emit(label=label, status=status, stdout=stdout)


def set_current_location(line: Optional[int]) -> None:
    _TRACE.set_current_location(line)


def export_trace() -> Dict[str, Any]:
    return {"frames": _TRACE.export_frames()}


def delVis(value: Any) -> bool:
    if isinstance(value, _NestedArray):
        value = value._root

    if isinstance(value, _VisObject):
        removed = value._detach_visualization()
        if removed:
            _TRACE.emit(label=f"delVis({value.title})")
        return removed

    if isinstance(value, VisTreeNode):
        panel = _TREE_PANEL
        if panel is None:
            return False
        removed = panel._unregister(value)
        if removed:
            object.__setattr__(value, "_is_visualized", False)
            _TRACE.emit(label=f"delVis({value._id})")
        return removed

    if isinstance(value, VisListNode):
        panel = _LIST_PANEL
        if panel is None:
            return False
        removed = panel._unregister(value)
        if removed:
            object.__setattr__(value, "_is_visualized", False)
            _TRACE.emit(label=f"delVis({value._id})")
        return removed

    return False


def _call_uses_constructor(node: ast.AST, constructor_name: str) -> bool:
    if not isinstance(node, ast.Call):
        return False
    if isinstance(node.func, ast.Name):
        return node.func.id == constructor_name
    if isinstance(node.func, ast.Attribute):
        return node.func.attr == constructor_name
    return False


def _node_spans_line(node: ast.AST, lineno: int) -> bool:
    start = getattr(node, "lineno", None)
    end = getattr(node, "end_lineno", start)
    if start is None:
        return False
    return start <= lineno <= (end if end is not None else start)


def _extract_assigned_name(target: ast.expr) -> Optional[str]:
    if isinstance(target, ast.Name):
        return target.id
    return None


def _infer_constructor_target_name(frame, constructor_name: str) -> Optional[str]:
    filename = getattr(frame.f_code, "co_filename", "")
    if not filename:
        return None

    source_lines = linecache.getlines(filename, frame.f_globals)
    if not source_lines:
        return None

    try:
        tree = ast.parse("".join(source_lines), filename=filename)
    except SyntaxError:
        return None

    best_name: Optional[str] = None
    best_span: Optional[Tuple[int, int]] = None
    current_line = frame.f_lineno

    for node in ast.walk(tree):
        target = None
        value = None
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            value = node.value
        elif isinstance(node, ast.AnnAssign):
            target = node.target
            value = node.value

        if target is None or value is None:
            continue
        if not _call_uses_constructor(value, constructor_name):
            continue
        if not _node_spans_line(value, current_line):
            continue

        assigned_name = _extract_assigned_name(target)
        if not assigned_name:
            continue

        start = getattr(value, "lineno", current_line)
        end = getattr(value, "end_lineno", start)
        span = (end - start, start)
        if best_span is None or span < best_span:
            best_name = assigned_name
            best_span = span

    return best_name


class _VisObject:
    _id_counter = 0

    def __init__(
        self,
        title: str,
        type_label: str,
        layout: _PanelLayout,
        panel_id: Optional[str] = None,
    ) -> None:
        _VisObject._id_counter += 1
        self.id = panel_id or f"panel_{_VisObject._id_counter}"
        self.title = title
        self.type_label = type_label
        self.layout = layout
        self._is_visualized = True
        _TRACE.register_object(self)

    def _detach_visualization(self) -> bool:
        if not self._is_visualized:
            return False
        self._is_visualized = False
        return _TRACE.unregister_object(self)

    def _render_panel(self) -> Any:
        raise NotImplementedError


class _NestedArray:
    def __init__(self, root: "VisArray", path: Tuple[int, ...], values: List[Any]) -> None:
        self._root = root
        self._path = path
        self._values: List[Any] = []
        for idx, value in enumerate(values):
            self._values.append(self._root._wrap_array_value(value, path + (idx,)))

    def __len__(self) -> int:
        return len(self._values)

    def __iter__(self):
        for i in range(len(self._values)):
            yield self[i]

    def __getitem__(self, idx: int) -> Any:
        resolved = self._resolve_index(idx)
        value = self._values[resolved]
        self._root._active_path = self._path + (resolved,)
        return value

    def __setitem__(self, idx: int, value: Any) -> None:
        if isinstance(idx, slice):
            incoming = list(value)
            wrapped = [
                self._root._wrap_array_value(item, self._path + (start_idx,))
                for start_idx, item in enumerate(incoming, start=self._slice_anchor(idx))
            ]
            self._values[idx] = wrapped
            self._reindex_descendants()
            self._root._active_path = None
            self._root._emit_array_change(
                f"{self._path_expr()}[{idx.start}:{idx.stop}:{idx.step}] = {_safe_str(incoming)}"
            )
            return

        resolved = self._resolve_index(idx)
        self._values[resolved] = self._root._wrap_array_value(value, self._path + (resolved,))
        self._root._emit_array_change(
            f"{self._path_expr()}[{idx}] = {_safe_str(self._root._plain_array_value(value))}",
            active_path=self._path + (resolved,),
        )

    def __delitem__(self, idx) -> None:
        if isinstance(idx, slice):
            del self._values[idx]
            self._reindex_descendants()
            self._root._active_path = None
            self._root._emit_array_change(
                f"del {self._path_expr()}[{idx.start}:{idx.stop}:{idx.step}]"
            )
            return

        resolved = self._resolve_index(idx)
        del self._values[resolved]
        self._reindex_descendants()
        next_active = None if not self._values else self._path + (min(resolved, len(self._values) - 1),)
        self._root._emit_array_change(
            f"del {self._path_expr()}[{idx}]",
            active_path=next_active,
        )

    def append(self, value: Any) -> None:
        next_index = len(self._values)
        self._values.append(self._root._wrap_array_value(value, self._path + (next_index,)))
        self._reindex_descendants()
        self._root._emit_array_change(
            f"{self._path_expr()}.append({_safe_str(self._root._plain_array_value(value))})",
            active_path=self._path + (next_index,),
        )

    def insert(self, index: int, value: Any) -> None:
        resolved = self._normalize_insert_index(index)
        self._values.insert(resolved, self._root._wrap_array_value(value, self._path + (resolved,)))
        self._reindex_descendants()
        self._root._emit_array_change(
            f"{self._path_expr()}.insert({index}, {_safe_str(self._root._plain_array_value(value))})",
            active_path=self._path + (resolved,),
        )

    def pop(self, index: int = -1) -> Any:
        resolved = self._resolve_index(index)
        value = self._values.pop(resolved)
        self._reindex_descendants()
        next_active = None if not self._values else self._path + (min(resolved, len(self._values) - 1),)
        self._root._emit_array_change(
            f"{self._path_expr()}.pop({index})",
            active_path=next_active,
        )
        return value

    def remove(self, value: Any) -> None:
        needle = self._root._plain_array_value(value)
        for idx, current in enumerate(self._values):
            if self._root._plain_array_value(current) == needle:
                del self._values[idx]
                self._reindex_descendants()
                next_active = None if not self._values else self._path + (min(idx, len(self._values) - 1),)
                self._root._emit_array_change(
                    f"{self._path_expr()}.remove({_safe_str(needle)})",
                    active_path=next_active,
                )
                return
        raise ValueError("list.remove(x): x not in list")

    def reverse(self) -> None:
        self._values.reverse()
        self._reindex_descendants()
        active_path = None
        if self._root._active_path is not None and self._root._active_path[: len(self._path)] == self._path:
            if len(self._root._active_path) > len(self._path):
                old_index = self._root._active_path[len(self._path)]
                active_path = self._path + (len(self._values) - 1 - old_index,)
        self._root._emit_array_change(
            f"{self._path_expr()}.reverse()",
            active_path=active_path,
        )

    def clear(self) -> None:
        self._values.clear()
        self._root._emit_array_change(f"{self._path_expr()}.clear()", active_path=None)

    def extend(self, values: List[Any]) -> None:
        incoming = list(values)
        start = len(self._values)
        for offset, value in enumerate(incoming):
            self._values.append(self._root._wrap_array_value(value, self._path + (start + offset,)))
        self._reindex_descendants()
        active_path = None if not self._values else self._path + (len(self._values) - 1,)
        self._root._emit_array_change(
            f"{self._path_expr()}.extend({_safe_str([self._root._plain_array_value(v) for v in incoming])})",
            active_path=active_path,
        )

    def to_plain_list(self) -> List[Any]:
        return [self._root._plain_array_value(value) for value in self._values]

    def _resolve_index(self, idx: int) -> int:
        if not self._values:
            raise IndexError("list index out of range")
        if idx < 0:
            idx += len(self._values)
        if idx < 0 or idx >= len(self._values):
            raise IndexError("list index out of range")
        return idx

    def _normalize_insert_index(self, idx: int) -> int:
        if idx < 0:
            idx += len(self._values)
        if idx < 0:
            return 0
        if idx > len(self._values):
            return len(self._values)
        return idx

    def _slice_anchor(self, idx: slice) -> int:
        start = idx.start if idx.start is not None else 0
        if start < 0:
            start += len(self._values)
        return max(0, min(len(self._values), start))

    def _path_expr(self) -> str:
        return self._root._path_expr(self._path)

    def _reindex_descendants(self) -> None:
        for idx, value in enumerate(self._values):
            if isinstance(value, _NestedArray):
                value._set_path(self._path + (idx,))

    def _set_path(self, path: Tuple[int, ...]) -> None:
        self._path = path
        self._reindex_descendants()

    def __repr__(self) -> str:
        return repr(self.to_plain_list())

    def __str__(self) -> str:
        return str(self.to_plain_list())


class VisArray(_VisObject):
    def __init__(
        self,
        values: List[Any],
        name: Optional[str] = None,
        *,
        panel_id: Optional[str] = None,
        x: float = 8,
        y: float = 12,
        width: float = 42,
        height: float = 16,
        scale: float = 1.0,
    ) -> None:
        self._uses_default_layout = (
            panel_id is None
            and x == 8
            and y == 12
            and width == 42
            and height == 16
            and scale == 1.0
        )
        resolved_name = name
        if resolved_name is None:
            frame = inspect.currentframe()
            try:
                caller = frame.f_back if frame is not None else None
                resolved_name = (
                    _infer_constructor_target_name(caller, "VisArray")
                    if caller is not None
                    else None
                )
            finally:
                del frame
            if not resolved_name:
                resolved_name = "array"

        if self._uses_default_layout:
            layout = _TRACE.suggest_panel_layout(
                preferred_x=x,
                preferred_y=y,
                width=width,
                height=height,
                scale=scale,
            )
        else:
            layout = _PanelLayout(x=x, y=y, width=width, height=height, scale=scale)

        super().__init__(
            title=resolved_name,
            type_label="VisArray",
            panel_id=panel_id,
            layout=layout,
        )
        self._active_path: Optional[Tuple[int, ...]] = None
        self._root_array = _NestedArray(self, (), list(values))
        _TRACE.emit(label=f"{resolved_name}: init")

    def __len__(self) -> int:
        return len(self._root_array)

    def __iter__(self):
        return iter(self._root_array)

    def __getitem__(self, idx: int) -> Any:
        return self._root_array[idx]

    def __setitem__(self, idx: int, value: Any) -> None:
        self._root_array[idx] = value

    def __delitem__(self, idx) -> None:
        del self._root_array[idx]

    def append(self, value: Any) -> None:
        self._root_array.append(value)

    def insert(self, index: int, value: Any) -> None:
        self._root_array.insert(index, value)

    def pop(self, index: int = -1) -> Any:
        return self._root_array.pop(index)

    def remove(self, value: Any) -> None:
        self._root_array.remove(value)

    def reverse(self) -> None:
        self._root_array.reverse()

    def clear(self) -> None:
        self._root_array.clear()

    def extend(self, values: List[Any]) -> None:
        self._root_array.extend(values)

    def _path_expr(self, path: Tuple[int, ...]) -> str:
        result = self.title
        for segment in path:
            result += f"[{segment}]"
        return result

    def _wrap_array_value(self, value: Any, path: Tuple[int, ...]) -> Any:
        if isinstance(value, _NestedArray):
            value = value.to_plain_list()
        if isinstance(value, list):
            return _NestedArray(self, path, list(value))
        return value

    def _plain_array_value(self, value: Any) -> Any:
        if isinstance(value, _NestedArray):
            return value.to_plain_list()
        return value

    def _emit_array_change(self, label: str, active_path: Optional[Tuple[int, ...]] = None) -> None:
        if not self._is_visualized:
            self._active_path = active_path
            return
        self._active_path = active_path
        _TRACE.emit(label=label)

    def _infer_dimensions(self, values: List[Any]) -> Optional[Tuple[int, ...]]:
        if not values:
            return (0,)

        child_dims: List[Tuple[int, ...]] = []
        has_arrays = False
        has_scalars = False

        for value in values:
            if isinstance(value, _NestedArray):
                has_arrays = True
                nested_dims = self._infer_dimensions(value._values)
                if nested_dims is None:
                    return None
                child_dims.append(nested_dims)
            else:
                has_scalars = True
                child_dims.append(())

        if has_arrays and has_scalars:
            return None
        if not has_arrays:
            return (len(values),)

        first = child_dims[0]
        if any(dims != first for dims in child_dims[1:]):
            return None
        return (len(values),) + first

    def _array_layout(self, values: List[Any]) -> str:
        if not values:
            return "row"
        if all(not isinstance(value, _NestedArray) for value in values):
            return "row"
        if all(isinstance(value, _NestedArray) for value in values):
            if all(
                all(not isinstance(child, _NestedArray) for child in value._values)
                for value in values
            ):
                return "matrix"
            return "stack"
        return "row"

    def _measure_scalar_width(self, value: Any) -> float:
        label = _safe_str(value)
        return min(20.0, max(10.0, 6.0 + (len(label) * 0.9)))

    def _measure_row(self, values: List[Any]) -> Tuple[float, float]:
        if not values:
            return 12.0, 1.4

        child_widths: List[float] = []
        child_heights: List[float] = []
        for value in values:
            if isinstance(value, _NestedArray):
                nested_width, nested_height = self._measure_block(value._values)
                child_widths.append(max(12.0, nested_width))
                child_heights.append(max(1.8, nested_height))
            else:
                child_widths.append(self._measure_scalar_width(value))
                child_heights.append(1.0)

        total_width = sum(child_widths) + max(0, len(values) - 1) * 3.0 + 4.0
        total_height = max(child_heights) + 0.8
        return total_width, total_height

    def _measure_block(self, values: List[Any]) -> Tuple[float, float]:
        layout = self._array_layout(values)

        if layout == "row":
            return self._measure_row(values)

        if layout == "matrix":
            row_sizes = [
                self._measure_row(value._values)
                for value in values
                if isinstance(value, _NestedArray)
            ]
            if not row_sizes:
                return 14.0, 4.0
            width = max(size[0] for size in row_sizes) + 6.0
            height = sum(size[1] for size in row_sizes) + max(0, len(row_sizes) - 1) * 2.4 + 6.0
            return width, height

        child_sizes = [
            self._measure_block(value._values)
            for value in values
            if isinstance(value, _NestedArray)
        ]
        if not child_sizes:
            return 14.0, 4.0
        width = max(size[0] for size in child_sizes) + 8.0
        height = sum(size[1] for size in child_sizes) + max(0, len(child_sizes) - 1) * 3.2 + 6.0
        return width, height

    def _render_array_node(self, values: List[Any], path: Tuple[int, ...]) -> Dict[str, Any]:
        layout = self._array_layout(values)
        dimensions = self._infer_dimensions(values)
        rendered_cells: List[Dict[str, Any]] = []

        for idx, value in enumerate(values):
            cell_path = path + (idx,)
            is_active = self._active_path == cell_path
            contains_active = (
                self._active_path is not None
                and len(self._active_path) > len(cell_path)
                and self._active_path[: len(cell_path)] == cell_path
            )
            cell_id = f"{self.id}_{'_'.join(str(part) for part in cell_path)}"

            if isinstance(value, _NestedArray):
                nested = self._render_array_node(value._values, cell_path)
                rendered_cells.append(
                    {
                        "id": cell_id,
                        "kind": "array",
                        "layout": nested["layout"],
                        "dimensions": nested["dimensions"],
                        "tone": "active" if is_active else "default",
                        "containsActive": contains_active,
                        "cells": nested["cells"],
                    }
                )
                continue

            rendered_cells.append(
                {
                    "id": cell_id,
                    "kind": "value",
                    "label": _safe_str(value),
                    "tone": "active" if is_active else "default",
                    "containsActive": contains_active,
                }
            )

        return {
            "layout": layout,
            "dimensions": list(dimensions) if dimensions is not None else None,
            "cells": rendered_cells,
        }

    def _render_panel(self) -> Dict[str, Any]:
        root_values = self._root_array._values
        rendered_root = self._render_array_node(root_values, ())
        layout = rendered_root["layout"]
        width_units, height_units = self._measure_block(root_values)
        max_width = 54.0 if layout == "row" else 58.0 if layout == "matrix" else 62.0
        min_width = 22.0 if layout == "row" else 26.0 if layout == "matrix" else 30.0
        preferred_width = min(max_width, max(min_width, 10.0 + (width_units * 0.48)))

        min_height = 12.0 if layout == "row" else 18.0 if layout == "matrix" else 20.0
        if layout == "row":
            preferred_height = min(28.0, max(min_height, 4.5 + (height_units * 4.1)))
        elif layout == "matrix":
            preferred_height = min(78.0, max(min_height, 5.0 + (height_units * 5.2)))
        else:
            preferred_height = min(78.0, max(min_height, 6.0 + (height_units * 5.8)))

        width = preferred_width if self._uses_default_layout else max(self.layout.width, min_width)
        height = preferred_height if self._uses_default_layout else max(self.layout.height, min_height)

        return {
            "id": self.id,
            "kind": "array",
            "title": self.title,
            "typeLabel": self.type_label,
            "x": self.layout.x,
            "y": self.layout.y,
            "width": width,
            "height": height,
            "minWidth": min_width,
            "minHeight": min_height,
            "maxWidth": max_width,
            "scale": self.layout.scale,
            "layout": rendered_root["layout"],
            "dimensions": rendered_root["dimensions"],
            "cells": rendered_root["cells"],
        }


@dataclass(eq=False)
class _BSTNode:
    val: Any
    left: Optional["_BSTNode"] = None
    right: Optional["_BSTNode"] = None


class VisBST(_VisObject):
    def __init__(
        self,
        name: str = "bst",
        *,
        panel_id: Optional[str] = None,
        x: float = 18,
        y: float = 36,
        width: float = 28,
        height: float = 26,
        scale: float = 1.0,
    ) -> None:
        super().__init__(
            title=name,
            type_label="VisBST",
            panel_id=panel_id,
            layout=_PanelLayout(x=x, y=y, width=width, height=height, scale=scale),
        )
        self._root: Optional[_BSTNode] = None
        _TRACE.emit(label=f"{name}: init")

    def insert(self, value: Any) -> None:
        if self._root is None:
            self._root = _BSTNode(value)
            if self._is_visualized:
                _TRACE.emit(label=f"insert({_safe_str(value)})")
            return

        cur = self._root
        while True:
            if value < cur.val:
                if cur.left is None:
                    cur.left = _BSTNode(value)
                    break
                cur = cur.left
            else:
                if cur.right is None:
                    cur.right = _BSTNode(value)
                    break
                cur = cur.right
        if self._is_visualized:
            _TRACE.emit(label=f"insert({_safe_str(value)})")

    def _render_panel(self) -> Dict[str, Any]:
        if self._root is None:
            return {
                "id": self.id,
                "kind": "bst",
                "title": self.title,
                "typeLabel": self.type_label,
                "x": self.layout.x,
                "y": self.layout.y,
                "width": self.layout.width,
                "height": self.layout.height,
                "scale": self.layout.scale,
                "items": [],
                "edges": [],
            }

        nodes: List[_BSTNode] = []
        edges: List[Tuple[_BSTNode, _BSTNode]] = []
        depths: Dict[_BSTNode, int] = {}

        def walk(n: Optional[_BSTNode], depth: int) -> None:
            if n is None:
                return
            depths[n] = depth
            walk(n.left, depth + 1)
            nodes.append(n)
            walk(n.right, depth + 1)

        walk(self._root, 0)

        def collect_edges(n: Optional[_BSTNode]) -> None:
            if n is None:
                return
            if n.left is not None:
                edges.append((n, n.left))
            if n.right is not None:
                edges.append((n, n.right))
            collect_edges(n.left)
            collect_edges(n.right)

        collect_edges(self._root)

        max_depth = max(depths.values()) if depths else 0
        x_left = 20.0
        x_right = 80.0
        x_step = 0.0 if len(nodes) == 1 else (x_right - x_left) / (len(nodes) - 1)

        node_to_id: Dict[_BSTNode, str] = {}
        items = []
        for i, n in enumerate(nodes):
            node_id = f"{self.id}_n{i}"
            node_to_id[n] = node_id
            depth = depths.get(n, 0)
            y = 18.0 if max_depth == 0 else 18.0 + (70.0 * (depth / max_depth))
            items.append(
                {
                    "id": node_id,
                    "label": _safe_str(n.val),
                    "x": x_left + x_step * i,
                    "y": y,
                    "shape": "circle",
                    "tone": "default",
                }
            )

        rendered_edges = []
        for parent, child in edges:
            rendered_edges.append(
                {"from": node_to_id[parent], "to": node_to_id[child]}
            )

        return {
            "id": self.id,
            "kind": "bst",
            "title": self.title,
            "typeLabel": self.type_label,
            "x": self.layout.x,
            "y": self.layout.y,
            "width": self.layout.width,
            "height": self.layout.height,
            "scale": self.layout.scale,
            "items": items,
            "edges": rendered_edges,
        }

class VisTreeNode:
    _node_counter = 0

    def __init__(self, val: Any, left: Optional["VisTreeNode"] = None, right: Optional["VisTreeNode"] = None) -> None:
        VisTreeNode._node_counter += 1
        frame = inspect.currentframe()
        try:
            caller = frame.f_back if frame is not None else None
            display_name = (
                _infer_constructor_target_name(caller, "VisTreeNode")
                if caller is not None
                else None
            )
        finally:
            del frame
        object.__setattr__(self, "_id", f"tn_{VisTreeNode._node_counter}")
        object.__setattr__(self, "_is_visualized", True)
        object.__setattr__(self, "_display_name", display_name)
        object.__setattr__(self, "val", val)
        object.__setattr__(self, "left", left)
        object.__setattr__(self, "right", right)
        _ensure_tree_panel()._register(self)
        _TRACE.emit(label=f"node({self._id}): init")

    def __setattr__(self, name: str, value: Any) -> None:
        if name in ("val", "left", "right"):
            object.__setattr__(self, name, value)
            if not getattr(self, "_is_visualized", True):
                return
            _TRACE.touch(self._id)
            _TRACE.emit(label=f"{self._id}.{name} = {_safe_str(value if name == 'val' else getattr(value, '_id', value))}")
            return
        object.__setattr__(self, name, value)


class VisListNode:
    _node_counter = 0

    def __init__(self, val: Any, right: Optional["VisListNode"] = None) -> None:
        VisListNode._node_counter += 1
        frame = inspect.currentframe()
        try:
            caller = frame.f_back if frame is not None else None
            display_name = (
                _infer_constructor_target_name(caller, "VisListNode")
                if caller is not None
                else None
            )
        finally:
            del frame
        object.__setattr__(self, "_id", f"ln_{VisListNode._node_counter}")
        object.__setattr__(self, "_is_visualized", True)
        object.__setattr__(self, "_display_name", display_name)
        object.__setattr__(self, "val", val)
        object.__setattr__(self, "right", right)
        _ensure_list_panel()._register(self)
        _TRACE.emit(label=f"list_node({self._id}): init")

    def __setattr__(self, name: str, value: Any) -> None:
        if name in ("val", "right"):
            object.__setattr__(self, name, value)
            if not getattr(self, "_is_visualized", True):
                return
            _TRACE.touch(self._id)
            rendered = value if name == "val" else getattr(value, "_id", value)
            _TRACE.emit(label=f"{self._id}.{name} = {_safe_str(rendered)}")
            return
        object.__setattr__(self, name, value)


class _TreePanel(_VisObject):
    def __init__(
        self,
        title: str = "root",
        *,
        panel_id: str = "tree",
        x: float = 18,
        y: float = 36,
        width: float = 28,
        height: float = 26,
        scale: float = 1.0,
    ) -> None:
        super().__init__(
            title=title,
            type_label="VisTreeNode",
            panel_id=panel_id,
            layout=_PanelLayout(x=x, y=y, width=width, height=height, scale=scale),
        )
        self._nodes: Dict[str, VisTreeNode] = {}
        self._component_states: List[_DynamicPanelState] = []
        self._panel_counter = 0

    def _register(self, node: VisTreeNode) -> None:
        self._nodes[node._id] = node

    def _unregister(self, node: VisTreeNode) -> bool:
        removed = self._nodes.pop(node._id, None) is not None
        if removed and not self._nodes:
            self._detach_visualization()
            global _TREE_PANEL
            _TREE_PANEL = None
        return removed

    def _next_panel_id(self) -> str:
        self._panel_counter += 1
        return f"tree_panel_{self._panel_counter}"

    def _derive_component_title(self, nodes: List[VisTreeNode], fallback_prefix: str) -> str:
        for node in nodes:
            display_name = getattr(node, "_display_name", None)
            if display_name:
                return display_name
        self._panel_counter += 1
        return f"{fallback_prefix} {self._panel_counter}"

    def _suggest_component_layout(
        self,
        *,
        width: float,
        height: float,
        scale: float,
        occupied_layouts: List[_PanelLayout],
    ) -> _PanelLayout:
        base_x = self.layout.x
        base_y = self.layout.y
        candidates = [
            (base_x, base_y),
            (base_x + 28.0, base_y),
            (base_x, base_y + 24.0),
            (base_x + 28.0, base_y + 24.0),
            (base_x, base_y + 48.0),
            (base_x + 28.0, base_y + 48.0),
        ]

        other_layouts = [obj.layout for obj in _TRACE._objects if obj is not self]

        def overlaps(layout: _PanelLayout, x: float, y: float) -> bool:
            left = x
            top = y
            right = x + width
            bottom = y + height
            if right <= layout.x or left >= layout.x + layout.width:
                return False
            if bottom <= layout.y or top >= layout.y + layout.height:
                return False
            return True

        for x, y in candidates:
            if any(overlaps(layout, x, y) for layout in occupied_layouts):
                continue
            if any(overlaps(layout, x, y) for layout in other_layouts):
                continue
            return _PanelLayout(x=x, y=y, width=width, height=height, scale=scale)

        return _PanelLayout(
            x=base_x,
            y=base_y + (len(occupied_layouts) * 20.0),
            width=width,
            height=height,
            scale=scale,
        )

    def _match_component_states(
        self,
        components: List[Dict[str, Any]],
        *,
        fallback_prefix: str,
        default_width: float,
        default_height: float,
        scale: float,
    ) -> List[_DynamicPanelState]:
        previous_states = list(self._component_states)
        matched_states: List[Optional[_DynamicPanelState]] = [None] * len(components)
        taken_state_indexes = set()

        overlap_pairs: List[Tuple[int, int, int]] = []
        for component_index, component in enumerate(components):
            component_node_ids = component["node_ids"]
            for state_index, state in enumerate(previous_states):
                overlap = len(component_node_ids & state.node_ids)
                if overlap > 0:
                    overlap_pairs.append((overlap, component_index, state_index))

        overlap_pairs.sort(key=lambda item: (-item[0], item[1], item[2]))
        for _, component_index, state_index in overlap_pairs:
            if matched_states[component_index] is not None or state_index in taken_state_indexes:
                continue
            state = previous_states[state_index]
            state.node_ids = set(components[component_index]["node_ids"])
            matched_states[component_index] = state
            taken_state_indexes.add(state_index)

        occupied_layouts = [
            state.layout
            for state in matched_states
            if state is not None
        ]

        for component_index, component in enumerate(components):
            if matched_states[component_index] is not None:
                continue
            panel_id = self._next_panel_id()
            layout = self._suggest_component_layout(
                width=default_width,
                height=default_height,
                scale=scale,
                occupied_layouts=occupied_layouts,
            )
            state = _DynamicPanelState(
                panel_id=panel_id,
                title=self._derive_component_title(component["nodes"], fallback_prefix),
                layout=layout,
                node_ids=set(component["node_ids"]),
            )
            matched_states[component_index] = state
            occupied_layouts.append(layout)

        self._component_states = [state for state in matched_states if state is not None]
        return self._component_states

    def _render_panel(self) -> List[Dict[str, Any]]:
        all_nodes = list(self._nodes.values())
        nodes_by_id: Dict[str, VisTreeNode] = {n._id: n for n in all_nodes}
        if not all_nodes:
            self._component_states = []
            return []

        # Determine roots (nodes not referenced as a child).
        child_ids = set()
        for n in all_nodes:
            if isinstance(n.left, VisTreeNode) and n.left._id in nodes_by_id:
                child_ids.add(n.left._id)
            if isinstance(n.right, VisTreeNode) and n.right._id in nodes_by_id:
                child_ids.add(n.right._id)
        roots = [n for n in all_nodes if n._id not in child_ids]
        if not roots:
            roots = [all_nodes[0]]

        def reachable_ids(root: VisTreeNode) -> set:
            seen: set = set()
            stack = [root]
            while stack:
                cur = stack.pop()
                if cur is None or not isinstance(cur, VisTreeNode):
                    continue
                if cur._id in seen:
                    continue
                seen.add(cur._id)
                if isinstance(cur.left, VisTreeNode) and cur.left._id in nodes_by_id:
                    stack.append(cur.left)
                if isinstance(cur.right, VisTreeNode) and cur.right._id in nodes_by_id:
                    stack.append(cur.right)
            return seen

        def node_order(n: VisTreeNode) -> int:
            try:
                # tn_123 -> 123
                return int(str(n._id).split("_", 1)[1])
            except Exception:
                return 10**9

        def ordered_component(root: VisTreeNode) -> List[VisTreeNode]:
            ids = reachable_ids(root)
            return [nodes_by_id[nid] for nid in sorted(ids, key=lambda node_id: node_order(nodes_by_id[node_id])) if nid in nodes_by_id]

        component_roots: List[VisTreeNode] = []
        covered_ids = set()
        for root in sorted(roots, key=node_order):
            ids = reachable_ids(root)
            if not ids:
                continue
            component_roots.append(root)
            covered_ids.update(ids)

        for node in sorted(all_nodes, key=node_order):
            if node._id in covered_ids:
                continue
            component_roots.append(node)
            covered_ids.update(reachable_ids(node))

        def build_component_layout(root: VisTreeNode) -> Dict[str, Any]:
            nodes = ordered_component(root)
            x_left = 22.0
            x_right = 78.0
            x_span = x_right - x_left
            top_y = 18.0
            row_gap = 36.0
            node_diameter = 9.0
            bottom_padding = 12.0

            node_depth: Dict[str, int] = {}
            node_slot: Dict[str, int] = {}
            max_depth = 0

            def layout(n: Optional[VisTreeNode], depth: int, slot: int, seen: set) -> None:
                nonlocal max_depth
                if n is None or not isinstance(n, VisTreeNode) or n._id in seen:
                    return
                seen.add(n._id)
                max_depth = max(max_depth, depth)
                node_depth[n._id] = depth
                node_slot[n._id] = slot
                left_ok = isinstance(n.left, VisTreeNode) and n.left._id in nodes_by_id
                right_ok = isinstance(n.right, VisTreeNode) and n.right._id in nodes_by_id
                if left_ok and right_ok:
                    layout(n.left, depth + 1, slot * 2, seen)
                    layout(n.right, depth + 1, slot * 2 + 1, seen)
                elif left_ok:
                    layout(n.left, depth + 1, slot * 2, seen)
                elif right_ok:
                    layout(n.right, depth + 1, slot * 2 + 1, seen)

            layout(root, 0, 0, set())

            max_depth_slots = max(1, 2 ** max_depth)
            width_scale = max(1.0, max_depth_slots / 4.0)

            raw_items = []
            local_edges = []
            for node in nodes:
                if node._id not in node_slot:
                    continue
                depth = node_depth.get(node._id, 0)
                slot = node_slot[node._id]
                slot_fraction = (2 * slot + 1) / (2 ** (depth + 1))
                x_pct = x_left + (x_span * slot_fraction)
                y_pct = top_y + (depth * row_gap)
                raw_items.append(
                    {
                        "id": node._id,
                        "label": _safe_str(node.val),
                        "xPct": x_pct,
                        "yPct": y_pct,
                        "shape": "circle",
                        "tone": "active" if _TRACE.last_touched == node._id else "default",
                    }
                )
                if isinstance(node.left, VisTreeNode) and node.left._id in nodes_by_id:
                    local_edges.append({"from": node._id, "to": node.left._id})
                if isinstance(node.right, VisTreeNode) and node.right._id in nodes_by_id:
                    local_edges.append({"from": node._id, "to": node.right._id})

            depth_counts: Dict[int, int] = {}
            for depth in node_depth.values():
                depth_counts[depth] = depth_counts.get(depth, 0) + 1

            max_level_nodes = max(depth_counts.values()) if depth_counts else 1
            component_width = 320.0 * width_scale
            component_height = max(
                240.0,
                top_y + node_diameter + (max_depth * row_gap) + bottom_padding + 16.0,
            )

            local_items = []
            for item in raw_items:
                local_items.append(
                    {
                        "id": item["id"],
                        "label": item["label"],
                        "x": (item["xPct"] / 100.0) * component_width,
                        "y": (item["yPct"] / 100.0) * component_height,
                        "shape": item["shape"],
                        "tone": item["tone"],
                    }
                )

            return {
                "nodes": nodes,
                "node_ids": {node._id for node in nodes},
                "items": local_items,
                "edges": local_edges,
                "width": component_width,
                "height": component_height,
                "maxLevelNodes": max_level_nodes,
                "maxDepth": max_depth,
                "nodeCount": len(local_items),
                "rootOrder": node_order(root),
                "containsActive": any(item["tone"] == "active" for item in local_items),
            }

        components = [build_component_layout(root) for root in component_roots]
        components.sort(
            key=lambda component: (
                0 if component["containsActive"] else 1,
                -component["nodeCount"],
                component["rootOrder"],
            )
        )
        panel_states = self._match_component_states(
            components,
            fallback_prefix="tree",
            default_width=28.0,
            default_height=26.0,
            scale=self.layout.scale,
        )

        rendered_panels: List[Dict[str, Any]] = []
        for component, state in zip(components, panel_states):
            items = []
            for item in component["items"]:
                items.append(
                    {
                        **item,
                        "x": (item["x"] / component["width"]) * 100.0,
                        "y": (item["y"] / component["height"]) * 100.0,
                    }
                )
            items.sort(key=lambda it: (it["y"], it["x"]))

            rendered_panels.append(
                {
                    "id": state.panel_id,
                    "kind": "bst",
                    "title": state.title,
                    "typeLabel": self.type_label,
                    "x": state.layout.x,
                    "y": state.layout.y,
                    "width": state.layout.width,
                    "height": state.layout.height,
                    "minWidth": min(72.0, max(20.0, 18.0 + (component["maxLevelNodes"] * 4.5))),
                    "minHeight": min(82.0, max(20.0, 22.0 + (component["maxDepth"] * 4.0))),
                    "layoutWidth": component["width"],
                    "layoutHeight": component["height"],
                    "scale": state.layout.scale,
                    "items": items,
                    "edges": component["edges"],
                }
            )

        return rendered_panels


_TREE_PANEL: Optional[_TreePanel] = None


class _ListPanel(_VisObject):
    def __init__(
        self,
        title: str = "head",
        *,
        panel_id: str = "list",
        x: float = 14,
        y: float = 56,
        width: float = 30,
        height: float = 20,
        scale: float = 1.0,
    ) -> None:
        super().__init__(
            title=title,
            type_label="VisListNode",
            panel_id=panel_id,
            layout=_PanelLayout(x=x, y=y, width=width, height=height, scale=scale),
        )
        self._nodes: Dict[str, VisListNode] = {}
        self._component_states: List[_DynamicPanelState] = []
        self._panel_counter = 0

    def _register(self, node: VisListNode) -> None:
        self._nodes[node._id] = node

    def _unregister(self, node: VisListNode) -> bool:
        removed = self._nodes.pop(node._id, None) is not None
        if removed and not self._nodes:
            self._detach_visualization()
            global _LIST_PANEL
            _LIST_PANEL = None
        return removed

    def _next_panel_id(self) -> str:
        self._panel_counter += 1
        return f"list_panel_{self._panel_counter}"

    def _derive_component_title(self, nodes: List[VisListNode], fallback_prefix: str) -> str:
        for node in nodes:
            display_name = getattr(node, "_display_name", None)
            if display_name:
                return display_name
        self._panel_counter += 1
        return f"{fallback_prefix} {self._panel_counter}"

    def _suggest_component_layout(
        self,
        *,
        width: float,
        height: float,
        scale: float,
        occupied_layouts: List[_PanelLayout],
    ) -> _PanelLayout:
        base_x = self.layout.x
        base_y = self.layout.y
        candidates = [
            (base_x, base_y),
            (base_x + 28.0, base_y),
            (base_x, base_y + 24.0),
            (base_x + 28.0, base_y + 24.0),
            (base_x, base_y + 48.0),
            (base_x + 28.0, base_y + 48.0),
        ]

        other_layouts = [obj.layout for obj in _TRACE._objects if obj is not self]

        def overlaps(layout: _PanelLayout, x: float, y: float) -> bool:
            left = x
            top = y
            right = x + width
            bottom = y + height
            if right <= layout.x or left >= layout.x + layout.width:
                return False
            if bottom <= layout.y or top >= layout.y + layout.height:
                return False
            return True

        for x, y in candidates:
            if any(overlaps(layout, x, y) for layout in occupied_layouts):
                continue
            if any(overlaps(layout, x, y) for layout in other_layouts):
                continue
            return _PanelLayout(x=x, y=y, width=width, height=height, scale=scale)

        return _PanelLayout(
            x=base_x,
            y=base_y + (len(occupied_layouts) * 20.0),
            width=width,
            height=height,
            scale=scale,
        )

    def _match_component_states(
        self,
        components: List[Dict[str, Any]],
        *,
        fallback_prefix: str,
        default_width: float,
        default_height: float,
        scale: float,
    ) -> List[_DynamicPanelState]:
        previous_states = list(self._component_states)
        matched_states: List[Optional[_DynamicPanelState]] = [None] * len(components)
        taken_state_indexes = set()

        overlap_pairs: List[Tuple[int, int, int]] = []
        for component_index, component in enumerate(components):
            component_node_ids = component["node_ids"]
            for state_index, state in enumerate(previous_states):
                overlap = len(component_node_ids & state.node_ids)
                if overlap > 0:
                    overlap_pairs.append((overlap, component_index, state_index))

        overlap_pairs.sort(key=lambda item: (-item[0], item[1], item[2]))
        for _, component_index, state_index in overlap_pairs:
            if matched_states[component_index] is not None or state_index in taken_state_indexes:
                continue
            state = previous_states[state_index]
            state.node_ids = set(components[component_index]["node_ids"])
            matched_states[component_index] = state
            taken_state_indexes.add(state_index)

        occupied_layouts = [
            state.layout
            for state in matched_states
            if state is not None
        ]

        for component_index, component in enumerate(components):
            if matched_states[component_index] is not None:
                continue
            panel_id = self._next_panel_id()
            layout = self._suggest_component_layout(
                width=default_width,
                height=default_height,
                scale=scale,
                occupied_layouts=occupied_layouts,
            )
            state = _DynamicPanelState(
                panel_id=panel_id,
                title=self._derive_component_title(component["nodes"], fallback_prefix),
                layout=layout,
                node_ids=set(component["node_ids"]),
            )
            matched_states[component_index] = state
            occupied_layouts.append(layout)

        self._component_states = [state for state in matched_states if state is not None]
        return self._component_states

    def _render_panel(self) -> List[Dict[str, Any]]:
        all_nodes = list(self._nodes.values())
        nodes_by_id: Dict[str, VisListNode] = {n._id: n for n in all_nodes}
        if not all_nodes:
            self._component_states = []
            return []

        def node_order(n: VisListNode) -> int:
            try:
                return int(str(n._id).split("_", 1)[1])
            except Exception:
                return 10**9

        parent_ids: Dict[str, List[str]] = {}
        neighbors: Dict[str, List[str]] = {node._id: [] for node in all_nodes}

        for node in all_nodes:
            if isinstance(node.right, VisListNode) and node.right._id in nodes_by_id:
                child_id = node.right._id
                parent_ids.setdefault(child_id, []).append(node._id)
                neighbors[node._id].append(child_id)
                neighbors[child_id].append(node._id)

        sorted_nodes = sorted(all_nodes, key=node_order)
        components: List[List[VisListNode]] = []
        seen_component_ids = set()

        for start in sorted_nodes:
            if start._id in seen_component_ids:
                continue
            stack = [start._id]
            component_ids: List[str] = []
            while stack:
                current_id = stack.pop()
                if current_id in seen_component_ids:
                    continue
                seen_component_ids.add(current_id)
                component_ids.append(current_id)
                for neighbor_id in neighbors.get(current_id, []):
                    if neighbor_id not in seen_component_ids:
                        stack.append(neighbor_id)
            components.append(
                [
                    nodes_by_id[node_id]
                    for node_id in sorted(
                        component_ids,
                        key=lambda item_id: node_order(nodes_by_id[item_id]),
                    )
                ]
            )

        component_layouts = []
        left_padding = 28.0
        top_y = 38.0
        node_gap = 118.0
        row_gap = 82.0
        bottom_padding = 34.0

        for component in components:
            component_ids = {node._id for node in component}
            in_degree = {
                node._id: len(
                    [
                        parent_id
                        for parent_id in parent_ids.get(node._id, [])
                        if parent_id in component_ids
                    ]
                )
                for node in component
            }
            roots = [node for node in component if in_degree[node._id] == 0]
            if not roots:
                roots = [component[0]]

            depth_by_id: Dict[str, int] = {}
            queue: List[VisListNode] = list(sorted(roots, key=node_order))
            for root in queue:
                depth_by_id[root._id] = 0

            queue_index = 0
            while queue_index < len(queue):
                node = queue[queue_index]
                queue_index += 1
                child = (
                    node.right
                    if isinstance(node.right, VisListNode)
                    and node.right._id in component_ids
                    else None
                )
                if child is None:
                    continue
                next_depth = depth_by_id[node._id] + 1
                if child._id not in depth_by_id or next_depth < depth_by_id[child._id]:
                    depth_by_id[child._id] = next_depth
                    queue.append(child)

            fallback_depth = max(depth_by_id.values(), default=0)
            for node in component:
                if node._id not in depth_by_id:
                    fallback_depth += 1
                    depth_by_id[node._id] = fallback_depth

            local_y_by_id: Dict[str, float] = {}
            for root_index, root in enumerate(sorted(roots, key=node_order)):
                local_y_by_id[root._id] = float(root_index * row_gap)

            max_depth = max(depth_by_id.values(), default=0)
            for depth in range(1, max_depth + 1):
                depth_nodes = [node for node in component if depth_by_id[node._id] == depth]
                if not depth_nodes:
                    continue

                def desired_y(node: VisListNode) -> float:
                    parent_values = [
                        local_y_by_id[parent_id]
                        for parent_id in parent_ids.get(node._id, [])
                        if parent_id in local_y_by_id
                    ]
                    if parent_values:
                        return sum(parent_values) / len(parent_values)
                    return 0.0

                placed_y_values: List[float] = []
                for node in sorted(
                    depth_nodes,
                    key=lambda current: (desired_y(current), node_order(current)),
                ):
                    next_y = desired_y(node)
                    if placed_y_values and next_y < placed_y_values[-1] + row_gap:
                        next_y = placed_y_values[-1] + row_gap
                    local_y_by_id[node._id] = next_y
                    placed_y_values.append(next_y)

            component_max_local_y = max(local_y_by_id.values(), default=0.0)
            max_component_rows = max(1, int(round(component_max_local_y / row_gap)) + 1)
            items = []
            edges = []
            for node in component:
                x = left_padding + (depth_by_id[node._id] * node_gap)
                y = top_y + local_y_by_id[node._id]
                items.append(
                    {
                        "id": node._id,
                        "label": _safe_str(node.val),
                        "x": x,
                        "y": y,
                        "shape": "pill",
                        "tone": "active" if _TRACE.last_touched == node._id else "default",
                    }
                )
                if isinstance(node.right, VisListNode) and node.right._id in component_ids:
                    edges.append({"from": node._id, "to": node.right._id})

            component_layouts.append(
                {
                    "nodes": component,
                    "node_ids": component_ids,
                    "items": items,
                    "edges": edges,
                    "layoutWidth": max(320.0, left_padding * 2 + 72.0 + max_depth * node_gap),
                    "layoutHeight": max(120.0, top_y + component_max_local_y + bottom_padding),
                    "minWidth": min(72.0, max(28.0, 20.0 + ((max_depth + 1) * 8.5))),
                    "minHeight": min(72.0, max(20.0, 14.0 + max_component_rows * 9.0)),
                    "containsActive": any(item["tone"] == "active" for item in items),
                    "nodeCount": len(items),
                    "rootOrder": min(node_order(node) for node in roots) if roots else node_order(component[0]),
                }
            )

        component_layouts.sort(
            key=lambda component: (
                0 if component["containsActive"] else 1,
                -component["nodeCount"],
                component["rootOrder"],
            )
        )

        panel_states = self._match_component_states(
            component_layouts,
            fallback_prefix="list",
            default_width=30.0,
            default_height=20.0,
            scale=self.layout.scale,
        )

        rendered_panels: List[Dict[str, Any]] = []
        for component, state in zip(component_layouts, panel_states):
            rendered_panels.append(
                {
                    "id": state.panel_id,
                    "kind": "list",
                    "title": state.title,
                    "typeLabel": self.type_label,
                    "x": state.layout.x,
                    "y": state.layout.y,
                    "width": state.layout.width,
                    "height": state.layout.height,
                    "minWidth": component["minWidth"],
                    "minHeight": component["minHeight"],
                    "layoutWidth": component["layoutWidth"],
                    "layoutHeight": component["layoutHeight"],
                    "scale": state.layout.scale,
                    "items": component["items"],
                    "edges": component["edges"],
                }
            )

        return rendered_panels


def _ensure_tree_panel() -> _TreePanel:
    global _TREE_PANEL
    if _TREE_PANEL is None:
        _TREE_PANEL = _TreePanel()
    return _TREE_PANEL


_LIST_PANEL: Optional[_ListPanel] = None


def _ensure_list_panel() -> _ListPanel:
    global _LIST_PANEL
    if _LIST_PANEL is None:
        _LIST_PANEL = _ListPanel()
    return _LIST_PANEL


__all__ = [
    "delVis",
    "VisArray",
    "VisBST",
    "VisListNode",
    "VisTreeNode",
    "emit",
    "export_trace",
    "reset_trace",
    "set_current_location",
    "watch",
]
