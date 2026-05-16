from collections import deque
import sys
import unittest
from pathlib import Path
import runpy


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "public" / "py"))

from dsviz import (  # noqa: E402
    VisArray,
    VisDeque,
    VisHeap,
    VisListNode,
    VisMap,
    VisObject,
    VisQueue,
    VisSet,
    VisStack,
    VisTreeNode,
    export_trace,
    reset_trace,
)


class SequenceVisualTests(unittest.TestCase):
    def tearDown(self):
        reset_trace()

    def test_stack_renders_as_array_panel_with_references(self):
        child = VisArray([1, 2], name="child")
        stack = VisStack([child], name="stack")
        stack.push(3)
        frames = export_trace()["frames"]
        panels = frames[-1]["panels"]
        stack_panel = next(panel for panel in panels if panel["typeLabel"] == "VisStack")

        self.assertEqual(stack_panel["kind"], "array")
        self.assertEqual(stack_panel["cells"][0]["kind"], "ref")
        self.assertEqual(stack_panel["cells"][0]["targetPanelId"], child.id)
        self.assertEqual(stack_panel["cells"][1]["label"], "3")

    def test_array_renders_vis_children_as_references(self):
        child_stack = VisStack([1], name="child_stack")
        array = VisArray([child_stack, "ok"], name="array")
        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["typeLabel"] == "VisArray" and panel["title"] == "array"
        )

        self.assertEqual(panel["cells"][0]["kind"], "ref")
        self.assertEqual(panel["cells"][0]["targetPanelId"], child_stack.id)
        self.assertEqual(panel["cells"][1]["label"], "ok")

    def test_array_sort_supports_key_and_reverse(self):
        array = VisArray(
            [
                {"word": "bbb", "score": 2},
                {"word": "a", "score": 3},
                {"word": "cc", "score": 1},
            ],
            name="array",
        )
        array.sort(key=lambda item: (item["score"], len(item["word"])), reverse=True)

        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["typeLabel"] == "VisArray" and panel["title"] == "array"
        )
        labels = [cell["label"] for cell in panel["cells"]]

        self.assertEqual(labels, ["{'word': 'a', 'score': 3}", "{'word': 'bbb', 'score': 2}", "{'word': 'cc', 'score': 1}"])
        self.assertTrue(export_trace()["frames"][-1]["label"].startswith("array.sort("))

    def test_queue_and_deque_emit_expected_labels(self):
        queue = VisQueue(deque([1]), name="queue")
        queue.append(2)
        queue.popleft()
        dq = VisDeque(deque([5]), name="dq")
        dq.appendleft(4)
        dq.pop()
        labels = [frame["label"] for frame in export_trace()["frames"]]

        self.assertIn("queue.append(2)", labels)
        self.assertIn("queue.popleft()", labels)
        self.assertIn("dq.appendleft(4)", labels)
        self.assertIn("dq.pop()", labels)

    def test_legacy_queue_and_deque_aliases_still_work(self):
        queue = VisQueue(deque([1]), name="queue")
        queue.enqueue(2)
        queue.dequeue()
        dq = VisDeque(deque([5]), name="dq")
        dq.append_left(4)
        dq.pop_right()
        labels = [frame["label"] for frame in export_trace()["frames"]]

        self.assertIn("queue.enqueue(2)", labels)
        self.assertIn("queue.dequeue()", labels)
        self.assertIn("dq.append_left(4)", labels)
        self.assertIn("dq.pop_right()", labels)

    def test_set_preserves_reference_first_cells(self):
        child_map = VisMap({"a": 1}, name="child_map")
        seen = VisSet({child_map}, name="seen")
        panel = export_trace()["frames"][-1]["panels"][-1]

        self.assertEqual(panel["typeLabel"], "VisSet")
        self.assertEqual(panel["cells"][0]["kind"], "ref")
        self.assertEqual(panel["cells"][0]["targetPanelId"], child_map.id)

    def test_heap_uses_sequence_panel_and_heapifies_values(self):
        heap = VisHeap([5, 1, 3], name="heap")
        heap.heappush(2)
        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["typeLabel"] == "VisHeap"
        )

        self.assertEqual(panel["kind"], "array")
        labels = [cell["label"] for cell in panel["cells"]]
        self.assertEqual(labels[0], "1")
        self.assertIn("2", labels)

    def test_heap_legacy_aliases_still_work(self):
        heap = VisHeap([5, 1, 3], name="heap")
        heap.push(2)
        heap.replace(4)
        labels = [frame["label"] for frame in export_trace()["frames"]]

        self.assertIn("heap.push(2)", labels)
        self.assertIn("heap.replace(4)", labels)

    def test_tree_node_value_can_reference_other_visual_panels(self):
        child_map = VisMap({"a": 1}, name="child_map")
        root = VisTreeNode(child_map)
        panels = export_trace()["frames"][-1]["panels"]
        tree_panel = next(panel for panel in panels if panel["typeLabel"] == "VisTreeNode")
        root_item = next(item for item in tree_panel["items"] if item["id"] == root._id)

        self.assertEqual(root_item["label"], "child_map")
        self.assertEqual(root_item["targetPanelId"], child_map.id)
        self.assertTrue(root_item["clickable"])

    def test_list_node_value_can_reference_other_visual_panels(self):
        child_array = VisArray([9], name="child_array")
        head = VisListNode(child_array)
        panels = export_trace()["frames"][-1]["panels"]
        list_panel = next(panel for panel in panels if panel["typeLabel"] == "VisListNode")
        head_item = next(item for item in list_panel["items"] if item["id"] == head._id)

        self.assertEqual(head_item["label"], "child_array")
        self.assertEqual(head_item["targetPanelId"], child_array.id)
        self.assertTrue(head_item["clickable"])

    def test_map_can_reference_tree_and_list_panels(self):
        root = VisTreeNode(7)
        head = VisListNode(11)
        graph = VisMap({"tree": root, "list": head}, name="graph")
        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["typeLabel"] == "VisMap" and panel["title"] == "graph"
        )

        tree_entry = next(entry for entry in panel["entries"] if entry["key"]["label"] == "tree")
        list_entry = next(entry for entry in panel["entries"] if entry["key"]["label"] == "list")
        self.assertEqual(tree_entry["value"]["kind"], "ref")
        self.assertTrue(tree_entry["value"]["targetPanelId"].startswith("tree_panel_"))
        self.assertEqual(list_entry["value"]["kind"], "ref")
        self.assertTrue(list_entry["value"]["targetPanelId"].startswith("list_panel_"))

    def test_sequence_can_reference_tree_and_list_panels(self):
        root = VisTreeNode(3)
        head = VisListNode(5)
        stack = VisStack([root, head], name="stack")
        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["typeLabel"] == "VisStack" and panel["title"] == "stack"
        )

        self.assertEqual(panel["cells"][0]["kind"], "ref")
        self.assertTrue(panel["cells"][0]["targetPanelId"].startswith("tree_panel_"))
        self.assertEqual(panel["cells"][1]["kind"], "ref")
        self.assertTrue(panel["cells"][1]["targetPanelId"].startswith("list_panel_"))

    def test_map_list_map_cycle_renders_as_references(self):
        outer = VisMap(name="outer")
        head = VisListNode("placeholder")
        inner = VisMap({"outer": outer}, name="inner")
        head.val = inner
        outer["head"] = head

        panels = export_trace()["frames"][-1]["panels"]
        outer_panel = next(panel for panel in panels if panel["typeLabel"] == "VisMap" and panel["title"] == "outer")
        list_panel = next(panel for panel in panels if panel["typeLabel"] == "VisListNode")
        head_entry = next(entry for entry in outer_panel["entries"] if entry["key"]["label"] == "head")
        head_item = next(item for item in list_panel["items"] if item["id"] == head._id)

        self.assertEqual(head_entry["value"]["kind"], "ref")
        self.assertTrue(head_entry["value"]["targetPanelId"].startswith("list_panel_"))
        self.assertEqual(head_item["label"], "inner")
        self.assertEqual(head_item["targetPanelId"], inner.id)

    def test_nested_reference_example_runs(self):
        module = runpy.run_path(str(ROOT / "public" / "examples" / "nested-reference-example.py"))
        self.assertEqual(module["run_case"](), 10)

    def test_vis_bst_is_not_exported(self):
        import dsviz  # noqa: WPS433

        self.assertFalse(hasattr(dsviz, "VisBST"))

    def test_vis_object_renders_scalar_and_reference_attributes(self):
        class MyQueue:
            def __init__(self):
                self.in_stack = VisStack([1], name="in_stack")
                self.out_stack = VisStack([], name="out_stack")
                self.size = 1
                self._hidden = "skip"

        queue = MyQueue()
        queue_view = VisObject(queue, name="queue_view")
        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["title"] == "queue_view"
        )

        labels = [entry["key"]["label"] for entry in panel["entries"]]
        self.assertEqual(labels, ["in_stack", "out_stack", "size"])
        in_entry = next(entry for entry in panel["entries"] if entry["key"]["label"] == "in_stack")
        size_entry = next(entry for entry in panel["entries"] if entry["key"]["label"] == "size")
        self.assertEqual(in_entry["value"]["kind"], "ref")
        self.assertEqual(in_entry["value"]["targetPanelId"], queue.in_stack.id)
        self.assertEqual(size_entry["value"]["label"], "1")

    def test_vis_object_example_runs(self):
        module = runpy.run_path(str(ROOT / "public" / "examples" / "vis-object-example.py"))
        self.assertEqual(module["run_case"](), 1)

    def test_lru_cache_example_runs(self):
        module = runpy.run_path(str(ROOT / "public" / "examples" / "lru-cache-example.py"))
        self.assertEqual(module["run_case"](), 2)


if __name__ == "__main__":
    unittest.main()
