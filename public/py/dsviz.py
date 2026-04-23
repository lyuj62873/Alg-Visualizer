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
        self._values: List[Any] = list(values)
        self._active_index: Optional[int] = None
        _TRACE.emit(label=f"{name}: init")

    def __len__(self) -> int:
        return len(self._values)

    def __iter__(self):
        for i in range(len(self._values)):
            yield self[i]

    def __getitem__(self, idx: int) -> Any:
        resolved = self._resolve_index(idx)
        self._active_index = resolved
        return self._values[resolved]

    def __setitem__(self, idx: int, value: Any) -> None:
        if isinstance(idx, slice):
            self._values[idx] = list(value)
            self._active_index = None
            _TRACE.emit(label=f"{self.title}[{idx.start}:{idx.stop}:{idx.step}] = {_safe_str(value)}")
            return
        resolved = self._resolve_index(idx)
        self._values[resolved] = value
        self._active_index = resolved
        _TRACE.emit(label=f"{self.title}[{idx}] = {_safe_str(value)}")

    def __delitem__(self, idx) -> None:
        if isinstance(idx, slice):
            del self._values[idx]
            self._active_index = None
            _TRACE.emit(label=f"del {self.title}[{idx.start}:{idx.stop}:{idx.step}]")
            return
        resolved = self._resolve_index(idx)
        del self._values[resolved]
        self._active_index = None if not self._values else min(resolved, len(self._values) - 1)
        _TRACE.emit(label=f"del {self.title}[{idx}]")

    def append(self, value: Any) -> None:
        self._values.append(value)
        self._active_index = len(self._values) - 1
        _TRACE.emit(label=f"{self.title}.append({_safe_str(value)})")

    def insert(self, index: int, value: Any) -> None:
        resolved = self._normalize_insert_index(index)
        self._values.insert(resolved, value)
        self._active_index = resolved
        _TRACE.emit(label=f"{self.title}.insert({index}, {_safe_str(value)})")

    def pop(self, index: int = -1) -> Any:
        resolved = self._resolve_index(index)
        value = self._values.pop(resolved)
        self._active_index = None if not self._values else min(resolved, len(self._values) - 1)
        _TRACE.emit(label=f"{self.title}.pop({index})")
        return value

    def remove(self, value: Any) -> None:
        index = self._values.index(value)
        del self._values[index]
        self._active_index = None if not self._values else min(index, len(self._values) - 1)
        _TRACE.emit(label=f"{self.title}.remove({_safe_str(value)})")

    def reverse(self) -> None:
        self._values.reverse()
        if self._active_index is not None:
            self._active_index = len(self._values) - 1 - self._active_index
        _TRACE.emit(label=f"{self.title}.reverse()")

    def clear(self) -> None:
        self._values.clear()
        self._active_index = None
        _TRACE.emit(label=f"{self.title}.clear()")

    def extend(self, values: List[Any]) -> None:
        self._values.extend(values)
        self._active_index = len(self._values) - 1 if self._values else None
        _TRACE.emit(label=f"{self.title}.extend({_safe_str(values)})")

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

    def _render_panel(self) -> Dict[str, Any]:
        n = max(1, len(self._values))
        left = 14.0
        right = 86.0
        step = 0.0 if n == 1 else (right - left) / (n - 1)
        items = []
        for i, v in enumerate(self._values):
            items.append(
                {
                    "id": f"{self.id}_i{i}",
                    "label": _safe_str(v),
                    "x": left + step * i,
                    "y": 60.0,
                    "shape": "pill",
                    "tone": "active" if self._active_index == i else "default",
                }
            )
        return {
            "id": self.id,
            "kind": "array",
            "title": self.title,
            "typeLabel": self.type_label,
            "x": self.layout.x,
            "y": self.layout.y,
            "width": self.layout.width,
            "height": self.layout.height,
            "scale": self.layout.scale,
            "items": items,
            "edges": [],
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
        x_left = 14.0
        x_right = 86.0
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

        # Allocate horizontal space across roots proportional to leaf count, then layout each root
        # with an interval-based tree layout (root centered, children in sub-intervals).
        root_sizes: List[Tuple[VisTreeNode, int]] = []

        def leaf_count(n: Optional[VisTreeNode], seen: set) -> int:
            if n is None or not isinstance(n, VisTreeNode) or n._id in seen:
                return 0
            seen.add(n._id)
            left = leaf_count(n.left, seen)
            right = leaf_count(n.right, seen)
            if left == 0 and right == 0:
                return 1
            return max(1, left) + max(1, right)

        total = 0
        c = max(1, leaf_count(primary_root, set()))
        root_sizes.append((primary_root, c))
        total += c

        x_left = 14.0
        x_right = 86.0
        x_span = x_right - x_left

        node_pos: Dict[str, Tuple[float, float]] = {}
        node_depth: Dict[str, int] = {}
        max_depth = 0

        def layout(n: Optional[VisTreeNode], depth: int, x0: float, x1: float, seen: set) -> None:
            nonlocal max_depth
            if n is None or not isinstance(n, VisTreeNode) or n._id in seen:
                return
            seen.add(n._id)
            max_depth = max(max_depth, depth)
            node_depth[n._id] = depth
            xm = (x0 + x1) / 2.0
            node_pos[n._id] = (xm, 0.0)
            left_ok = isinstance(n.left, VisTreeNode)
            right_ok = isinstance(n.right, VisTreeNode)
            gap = 2.5
            if left_ok and right_ok:
                layout(n.left, depth + 1, x0, xm - gap, seen)
                layout(n.right, depth + 1, xm + gap, x1, seen)
            elif left_ok:
                # Avoid huge slants when only one child exists.
                layout(n.left, depth + 1, x0, xm, seen)
            elif right_ok:
                layout(n.right, depth + 1, xm, x1, seen)

        cursor = x_left
        for r, c in root_sizes:
            sub_left = cursor
            sub_right = cursor + (x_span * (c / total))
            cursor = sub_right
            layout(r, 0, sub_left, sub_right, set())

        items = []
        for node in nodes:
            if node._id not in node_pos:
                continue
            x, _ = node_pos[node._id]
            d = node_depth.get(node._id, 0)
            # Keep top padding so nodes don't collide with the panel header.
            y = 22.0 if max_depth == 0 else 22.0 + (64.0 * (d / max_depth))
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
