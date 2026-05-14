export const codeSample = `from dsviz import VisArray, VisTreeNode, watch

class Solution:
    def solve(self, root):
        max_val = 0
        watch("max_val", max_val)

        # Example mutation: attach a new node during execution.
        if root.right is not None:
            root.right.right = VisTreeNode(9)
            watch("added", 9)

        return root.val

def run_case():
    # Define your test input here (LeetCode-style node objects).
    root = VisTreeNode(5)
    root.left = VisTreeNode(3)
    root.right = VisTreeNode(8)
    root.left.right = VisTreeNode(4)
    sol = Solution()
    return sol.solve(root)`;

export type TraceContentCell =
  | {
      id: string;
      kind: "value";
      label: string;
      tone?: "default" | "active";
      containsActive?: boolean;
    }
  | {
      id: string;
      kind: "ref";
      label: string;
      targetPanelId?: string;
      clickable?: boolean;
      tone?: "default" | "active";
      containsActive?: boolean;
    }
  | {
      id: string;
      kind: "array";
      layout?: "row" | "matrix" | "stack";
      dimensions?: number[];
      tone?: "default" | "active";
      containsActive?: boolean;
      cells: TraceContentCell[];
    };

export type TraceMapEntry = {
  id: string;
  key: TraceContentCell;
  value: TraceContentCell;
  tone?: "default" | "active";
  containsActive?: boolean;
};

export type TraceVisualItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  shape?: "circle" | "pill";
  tone?: "default" | "active";
  containsActive?: boolean;
  targetPanelId?: string;
  clickable?: boolean;
};

type TracePanelBase = {
  id: string;
  title: string;
  typeLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export type TracePanel =
  | (TracePanelBase & {
      kind: "bst";
      layoutWidth?: number;
      layoutHeight?: number;
      items: TraceVisualItem[];
      edges: Array<{ from: string; to: string }>;
    })
  | (TracePanelBase & {
      kind: "list";
      layoutWidth?: number;
      layoutHeight?: number;
      items: TraceVisualItem[];
      edges: Array<{ from: string; to: string }>;
    })
  | (TracePanelBase & {
      kind: "array";
      layout?: "row" | "matrix" | "stack";
      dimensions?: number[];
      cells: TraceContentCell[];
    })
  | (TracePanelBase & {
      kind: "map";
      entries: TraceMapEntry[];
    });

export type TraceFrame = {
  index: number;
  label: string;
  line: number | null;
  panels: TracePanel[];
  variables: Array<{ name: string; value: string }>;
  status: string;
  stdout: string;
};

function valueCell(
  id: string,
  label: string,
  tone: "default" | "active" = "default",
): TraceContentCell {
  return { id, kind: "value", label, tone };
}

function arrayCell(
  id: string,
  cells: TraceContentCell[],
  layout: "row" | "matrix" | "stack" = "row",
  dimensions?: number[],
  tone: "default" | "active" = "default",
  containsActive = false,
): TraceContentCell {
  return { id, kind: "array", cells, layout, dimensions, tone, containsActive };
}

export const traceFrames: TraceFrame[] = [
  {
    index: 0,
    label: "nums: init",
    line: 15,
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 18,
        scale: 1,
        minWidth: 42,
        minHeight: 18,
        cells: [
          valueCell("n0", "5"),
          valueCell("n1", "3"),
          valueCell("n2", "8"),
          valueCell("n3", "4"),
        ],
      },
      {
        id: "matrix",
        kind: "array",
        title: "matrix",
        typeLabel: "VisArray",
        x: 54,
        y: 12,
        width: 30,
        height: 20,
        scale: 1,
        minWidth: 30,
        minHeight: 20,
        layout: "matrix",
        dimensions: [2, 2],
        cells: [
          arrayCell("m0", [valueCell("m0c0", "1"), valueCell("m0c1", "2")], "row", [2]),
          arrayCell("m1", [valueCell("m1c0", "3"), valueCell("m1c1", "4")], "row", [2]),
        ],
      },
      {
        id: "tree",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisTreeNode",
        x: 18,
        y: 38,
        width: 52,
        height: 48,
        scale: 1,
        items: [
          { id: "tn_1", label: "5", x: 50, y: 22, shape: "circle" },
          { id: "tn_2", label: "3", x: 28, y: 54, shape: "circle" },
          { id: "tn_3", label: "8", x: 72, y: 54, shape: "circle" },
        ],
        edges: [
          { from: "tn_1", to: "tn_2" },
          { from: "tn_1", to: "tn_3" },
        ],
      },
    ],
    variables: [{ name: "max_val", value: "0" }],
    status: "Trace ready. Edit run_case() and click Run Trace.",
    stdout: "stdout: run_case() started",
  },
  {
    index: 1,
    label: "nums[2] = 9",
    line: 9,
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 18,
        scale: 1,
        minWidth: 42,
        minHeight: 18,
        cells: [
          valueCell("n0", "5"),
          valueCell("n1", "3"),
          valueCell("n2", "9", "active"),
          valueCell("n3", "4"),
        ],
      },
      {
        id: "matrix",
        kind: "array",
        title: "matrix",
        typeLabel: "VisArray",
        x: 54,
        y: 12,
        width: 34,
        height: 22,
        scale: 1,
        minWidth: 34,
        minHeight: 22,
        layout: "matrix",
        dimensions: [2, 2],
        cells: [
          arrayCell("m0", [valueCell("m0c0", "1"), valueCell("m0c1", "2")], "row", [2]),
          arrayCell("m1", [valueCell("m1c0", "3"), valueCell("m1c1", "4")], "row", [2]),
        ],
      },
      {
        id: "tree",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisTreeNode",
        x: 18,
        y: 38,
        width: 52,
        height: 48,
        scale: 1,
        items: [
          { id: "tn_1", label: "5", x: 50, y: 22, shape: "circle" },
          { id: "tn_2", label: "3", x: 28, y: 54, shape: "circle" },
          { id: "tn_3", label: "8", x: 72, y: 54, shape: "circle", tone: "active" },
          { id: "tn_4", label: "9", x: 82, y: 82, shape: "circle" },
        ],
        edges: [
          { from: "tn_1", to: "tn_2" },
          { from: "tn_1", to: "tn_3" },
          { from: "tn_3", to: "tn_4" },
        ],
      },
    ],
    variables: [
      { name: "max_val", value: "0" },
      { name: "added", value: "9" },
    ],
    status: "Tree node 9 attached on the right branch.",
    stdout: "stdout: 2 frames emitted by dsviz",
  },
  {
    index: 2,
    label: "matrix[1].append(7)",
    line: 10,
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 18,
        scale: 1,
        minWidth: 42,
        minHeight: 18,
        cells: [
          valueCell("n0", "5"),
          valueCell("n1", "3"),
          valueCell("n2", "9"),
          valueCell("n3", "4"),
        ],
      },
      {
        id: "matrix",
        kind: "array",
        title: "matrix",
        typeLabel: "VisArray",
        x: 54,
        y: 12,
        width: 44,
        height: 26,
        scale: 1,
        minWidth: 44,
        minHeight: 26,
        layout: "matrix",
        dimensions: [2, 3],
        cells: [
          arrayCell("m0", [valueCell("m0c0", "1"), valueCell("m0c1", "2")], "row", [2]),
          arrayCell(
            "m1",
            [valueCell("m1c0", "3"), valueCell("m1c1", "4"), valueCell("m1c2", "7", "active")],
            "row",
            [3],
            "default",
            true,
          ),
        ],
      },
      {
        id: "tree",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisTreeNode",
        x: 18,
        y: 38,
        width: 52,
        height: 48,
        scale: 1,
        items: [
          { id: "tn_1", label: "5", x: 50, y: 22, shape: "circle" },
          { id: "tn_2", label: "3", x: 28, y: 54, shape: "circle" },
          { id: "tn_3", label: "8", x: 72, y: 54, shape: "circle" },
          { id: "tn_4", label: "9", x: 82, y: 82, shape: "circle" },
        ],
        edges: [
          { from: "tn_1", to: "tn_2" },
          { from: "tn_1", to: "tn_3" },
          { from: "tn_3", to: "tn_4" },
        ],
      },
    ],
    variables: [
      { name: "max_val", value: "0" },
      { name: "added", value: "9" },
      { name: "tail", value: "7" },
    ],
    status: "Nested array mutation emits a frame without writing the row back.",
    stdout: "stdout: nested array traced",
  },
  {
    index: 3,
    label: "return root.val",
    line: 11,
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 18,
        scale: 1,
        minWidth: 42,
        minHeight: 18,
        cells: [
          valueCell("n0", "5"),
          valueCell("n1", "3"),
          valueCell("n2", "9"),
          valueCell("n3", "4"),
        ],
      },
      {
        id: "matrix",
        kind: "array",
        title: "matrix",
        typeLabel: "VisArray",
        x: 54,
        y: 12,
        width: 44,
        height: 26,
        scale: 1,
        minWidth: 44,
        minHeight: 26,
        layout: "matrix",
        dimensions: [2, 3],
        cells: [
          arrayCell("m0", [valueCell("m0c0", "1"), valueCell("m0c1", "2")], "row", [2]),
          arrayCell("m1", [valueCell("m1c0", "3"), valueCell("m1c1", "4"), valueCell("m1c2", "7")], "row", [3]),
        ],
      },
      {
        id: "tree",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisTreeNode",
        x: 18,
        y: 38,
        width: 52,
        height: 48,
        scale: 1,
        items: [
          { id: "tn_1", label: "5", x: 50, y: 22, shape: "circle", tone: "active" },
          { id: "tn_2", label: "3", x: 28, y: 54, shape: "circle" },
          { id: "tn_3", label: "8", x: 72, y: 54, shape: "circle" },
          { id: "tn_4", label: "9", x: 82, y: 82, shape: "circle" },
        ],
        edges: [
          { from: "tn_1", to: "tn_2" },
          { from: "tn_1", to: "tn_3" },
          { from: "tn_3", to: "tn_4" },
        ],
      },
    ],
    variables: [
      { name: "max_val", value: "0" },
      { name: "added", value: "9" },
      { name: "tail", value: "7" },
    ],
    status: "Trace ready. Step through frames to inspect state.",
    stdout: "stdout: run_case() finished",
  },
];
