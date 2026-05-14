import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "public" / "py"))

from dsviz import (  # noqa: E402
    VisArray,
    VisDeque,
    VisHeap,
    VisMap,
    VisQueue,
    VisSet,
    VisStack,
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

    def test_queue_and_deque_emit_expected_labels(self):
        queue = VisQueue([1], name="queue")
        queue.enqueue(2)
        queue.dequeue()
        dq = VisDeque([5], name="dq")
        dq.append_left(4)
        dq.pop_right()
        labels = [frame["label"] for frame in export_trace()["frames"]]

        self.assertIn("queue.enqueue(2)", labels)
        self.assertIn("queue.dequeue()", labels)
        self.assertIn("dq.append_left(4)", labels)
        self.assertIn("dq.pop_right()", labels)

    def test_set_preserves_reference_first_cells(self):
        child_map = VisMap({"a": 1}, name="child_map")
        seen = VisSet([child_map], name="seen")
        panel = export_trace()["frames"][-1]["panels"][-1]

        self.assertEqual(panel["typeLabel"], "VisSet")
        self.assertEqual(panel["cells"][0]["kind"], "ref")
        self.assertEqual(panel["cells"][0]["targetPanelId"], child_map.id)

    def test_heap_uses_sequence_panel_and_heapifies_values(self):
        heap = VisHeap([5, 1, 3], name="heap")
        heap.push(2)
        panel = next(
            panel
            for panel in export_trace()["frames"][-1]["panels"]
            if panel["typeLabel"] == "VisHeap"
        )

        self.assertEqual(panel["kind"], "array")
        labels = [cell["label"] for cell in panel["cells"]]
        self.assertEqual(labels[0], "1")
        self.assertIn("2", labels)


if __name__ == "__main__":
    unittest.main()
