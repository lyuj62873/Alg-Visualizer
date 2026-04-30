from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


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
        self._current_line = None

    def register_object(self, obj: "_VisObject") -> None:
        self._objects.append(obj)

    def watch(self, name: str, value: Any) -> None:
        # Keep insertion order stable and emit a frame when the value changes.
        next_value = _safe_str(value)
        prev_value = self._variables.get(name)
        self._variables[name] = next_value
        if prev_value != next_value:
            self.emit(label=f"watch({name})")

    def emit(self, label: str, status: str = "", stdout: str = "") -> None:
        panels = [obj._render_panel() for obj in self._objects]
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
    _TREE_PANEL = None
    # Best-effort counter reset (module might not have loaded these symbols yet).
    try:
        _VisObject._id_counter = 0
    except Exception:
        pass
    try:
        globals().get("VisTreeNode")._node_counter = 0  # type: ignore[union-attr]
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
        _TRACE.register_object(self)

    def _render_panel(self) -> Dict[str, Any]:
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
        name: str = "array",
        *,
        panel_id: Optional[str] = None,
        x: float = 8,
        y: float = 12,
        width: float = 42,
        height: float = 16,
        scale: float = 1.0,
    ) -> None:
        if (
            panel_id is None
            and x == 8
            and y == 12
            and width == 42
            and height == 16
            and scale == 1.0
        ):
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
            title=name,
            type_label="VisArray",
            panel_id=panel_id,
            layout=layout,
        )
        self._active_path: Optional[Tuple[int, ...]] = None
        self._root_array = _NestedArray(self, (), list(values))
        _TRACE.emit(label=f"{name}: init")

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
        self._active_path = active_path
        _TRACE.emit(label=label)

    def _measure_cells(self, values: List[Any]) -> Tuple[float, float]:
        if not values:
            return 12.0, 1.4

        child_widths: List[float] = []
        child_heights: List[float] = []
        for value in values:
            if isinstance(value, _NestedArray):
                nested_width, nested_height = self._measure_cells(value._values)
                child_widths.append(max(18.0, nested_width + 7.0))
                child_heights.append(max(1.8, nested_height + 0.9))
            else:
                label = _safe_str(value)
                child_widths.append(min(20.0, max(10.0, 6.0 + (len(label) * 0.9))))
                child_heights.append(1.0)

        total_width = sum(child_widths) + max(0, len(values) - 1) * 3.0 + 4.0
        total_height = max(child_heights) + 0.8
        return total_width, total_height

    def _render_cells(self, values: List[Any], path: Tuple[int, ...]) -> List[Dict[str, Any]]:
        cells: List[Dict[str, Any]] = []
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
                cells.append(
                    {
                        "id": cell_id,
                        "kind": "array",
                        "tone": "active" if is_active else "default",
                        "containsActive": contains_active,
                        "cells": self._render_cells(value._values, cell_path),
                    }
                )
                continue

            cells.append(
                {
                    "id": cell_id,
                    "kind": "value",
                    "label": _safe_str(value),
                    "tone": "active" if is_active else "default",
                    "containsActive": contains_active,
                }
            )
        return cells

    def _render_panel(self) -> Dict[str, Any]:
        root_values = self._root_array._values
        width_units, height_units = self._measure_cells(root_values)
        min_width = min(88.0, max(self.layout.width, 12.0 + (width_units * 0.55)))
        min_height = min(84.0, max(self.layout.height, 8.0 + (height_units * 8.0)))

        return {
            "id": self.id,
            "kind": "array",
            "title": self.title,
            "typeLabel": self.type_label,
            "x": self.layout.x,
            "y": self.layout.y,
            "width": max(self.layout.width, min_width),
            "height": max(self.layout.height, min_height),
            "minWidth": min_width,
            "minHeight": min_height,
            "scale": self.layout.scale,
            "cells": self._render_cells(root_values, ()),
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
        width: float = 52,
        height: float = 50,
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
        object.__setattr__(self, "_id", f"tn_{VisTreeNode._node_counter}")
        object.__setattr__(self, "val", val)
        object.__setattr__(self, "left", left)
        object.__setattr__(self, "right", right)
        _ensure_tree_panel()._register(self)
        _TRACE.emit(label=f"node({self._id}): init")

    def __setattr__(self, name: str, value: Any) -> None:
        if name in ("val", "left", "right"):
            object.__setattr__(self, name, value)
            _TRACE.touch(self._id)
            _TRACE.emit(label=f"{self._id}.{name} = {_safe_str(value if name == 'val' else getattr(value, '_id', value))}")
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
        width: float = 52,
        height: float = 50,
        scale: float = 1.0,
    ) -> None:
        super().__init__(
            title=title,
            type_label="VisTreeNode",
            panel_id=panel_id,
            layout=_PanelLayout(x=x, y=y, width=width, height=height, scale=scale),
        )
        self._nodes: Dict[str, VisTreeNode] = {}

    def _register(self, node: VisTreeNode) -> None:
        self._nodes[node._id] = node

    def _render_panel(self) -> Dict[str, Any]:
        all_nodes = list(self._nodes.values())
        nodes_by_id: Dict[str, VisTreeNode] = {n._id: n for n in all_nodes}
        if not all_nodes:
            return {
                "id": self.id,
                "kind": "bst",
                "title": self.title,
                "typeLabel": self.type_label,
                "x": self.layout.x,
                "y": self.layout.y,
                "width": self.layout.width,
                "height": self.layout.height,
                "minWidth": 24.0,
                "minHeight": 22.0,
                "scale": self.layout.scale,
                "items": [],
                "edges": [],
            }

        # Determine roots (nodes not referenced as a child).
        child_ids = set()
        for n in all_nodes:
            if isinstance(n.left, VisTreeNode):
                child_ids.add(n.left._id)
            if isinstance(n.right, VisTreeNode):
                child_ids.add(n.right._id)
        roots = [n for n in all_nodes if n._id not in child_ids]
        if not roots:
            roots = [all_nodes[0]]

        # Pick a primary root: largest reachable component; tie-break by creation order.
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
                if isinstance(cur.left, VisTreeNode):
                    stack.append(cur.left)
                if isinstance(cur.right, VisTreeNode):
                    stack.append(cur.right)
            return seen

        def node_order(n: VisTreeNode) -> int:
            try:
                # tn_123 -> 123
                return int(str(n._id).split("_", 1)[1])
            except Exception:
                return 10**9

        primary_root = roots[0]
        primary_ids = reachable_ids(primary_root)
        best_size = len(primary_ids)
        best_order = node_order(primary_root)
        for r in roots[1:]:
            ids = reachable_ids(r)
            size = len(ids)
            order = node_order(r)
            if size > best_size or (size == best_size and order < best_order):
                primary_root = r
                primary_ids = ids
                best_size = size
                best_order = order

        # Only lay out / render the primary tree so newly-created but unattached nodes
        # don't cause the visible tree to jump around between frames.
        nodes = [nodes_by_id[nid] for nid in primary_ids if nid in nodes_by_id]

        x_left = 22.0
        x_right = 78.0
        x_span = x_right - x_left

        node_pos: Dict[str, Tuple[float, float]] = {}
        node_depth: Dict[str, int] = {}
        node_slot: Dict[str, int] = {}
        max_depth = 0
        top_y = 18.0
        row_gap = 36.0

        def layout(n: Optional[VisTreeNode], depth: int, slot: int, seen: set) -> None:
            nonlocal max_depth
            if n is None or not isinstance(n, VisTreeNode) or n._id in seen:
                return
            seen.add(n._id)
            max_depth = max(max_depth, depth)
            node_depth[n._id] = depth
            node_slot[n._id] = slot
            left_ok = isinstance(n.left, VisTreeNode)
            right_ok = isinstance(n.right, VisTreeNode)
            if left_ok and right_ok:
                layout(n.left, depth + 1, slot * 2, seen)
                layout(n.right, depth + 1, slot * 2 + 1, seen)
            elif left_ok:
                layout(n.left, depth + 1, slot * 2, seen)
            elif right_ok:
                layout(n.right, depth + 1, slot * 2 + 1, seen)

        layout(primary_root, 0, 0, set())

        items = []
        max_depth_slots = max(1, 2 ** max_depth)
        for node in nodes:
            if node._id not in node_slot:
                continue
            depth = node_depth.get(node._id, 0)
            slot = node_slot[node._id]
            slot_fraction = (2 * slot + 1) / (2 ** (depth + 1))
            x = x_left + (x_span * slot_fraction)
            y = top_y + (depth * row_gap)
            node_pos[node._id] = (x, y)
            items.append(
                {
                    "id": node._id,
                    "label": _safe_str(node.val),
                    "x": x,
                    "y": y,
                    "shape": "circle",
                    "tone": "active" if _TRACE.last_touched == node._id else "default",
                }
            )

        edges = []
        for node in nodes:
            if isinstance(node.left, VisTreeNode):
                edges.append({"from": node._id, "to": node.left._id})
            if isinstance(node.right, VisTreeNode):
                edges.append({"from": node._id, "to": node.right._id})

        # Sort items by y then x for stable render.
        items.sort(key=lambda it: (it["y"], it["x"]))

        depth_counts: Dict[int, int] = {}
        for depth in node_depth.values():
            depth_counts[depth] = depth_counts.get(depth, 0) + 1

        max_level_nodes = max(depth_counts.values()) if depth_counts else 1
        node_diameter = 9.0
        bottom_padding = 12.0
        width_scale = max(1.0, max_depth_slots / 4.0)
        layout_width = 320.0 * width_scale
        layout_height = max(240.0, top_y + node_diameter + (max_depth * row_gap) + bottom_padding + 16.0)
        min_width = min(72.0, max(20.0, 18.0 + (max_level_nodes * 4.5)))
        min_height = min(72.0, max(20.0, top_y + node_diameter + (max_depth * row_gap) + bottom_padding))

        return {
            "id": self.id,
            "kind": "bst",
            "title": self.title,
            "typeLabel": self.type_label,
            "x": self.layout.x,
            "y": self.layout.y,
            "width": self.layout.width,
            "height": self.layout.height,
            "minWidth": min_width,
            "minHeight": min_height,
            "layoutWidth": layout_width,
            "layoutHeight": layout_height,
            "scale": self.layout.scale,
            "items": items,
            "edges": edges,
        }


_TREE_PANEL: Optional[_TreePanel] = None


def _ensure_tree_panel() -> _TreePanel:
    global _TREE_PANEL
    if _TREE_PANEL is None:
        _TREE_PANEL = _TreePanel()
    return _TREE_PANEL


__all__ = [
    "VisArray",
    "VisBST",
    "VisTreeNode",
    "emit",
    "export_trace",
    "reset_trace",
    "set_current_location",
    "watch",
]
