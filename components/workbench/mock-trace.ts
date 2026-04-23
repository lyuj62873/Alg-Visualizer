export const codeSample = `from dsviz import VisArray, VisBST, watch

class Solution:
    def solve(self, nums):
        max_val = 0
        watch("max_val", max_val)

        bst = VisBST("working tree")
        for i, value in enumerate(nums):
            watch("i", i)
            bst.insert(value)
            if value > max_val:
                max_val = value
                watch("max_val", max_val)

        return max_val

def run_case():
    nums = VisArray(inputs["nums"], name="nums")
    sol = Solution()
    return sol.solve(nums)`;

export type TraceVisualItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  shape?: "circle" | "pill";
  tone?: "default" | "active";
};

export type TracePanel =
  | {
      id: string;
      kind: "bst";
      title: string;
      typeLabel: string;
      x: number;
      y: number;
      width: number;
      height: number;
      scale: number;
      items: TraceVisualItem[];
      edges: Array<{ from: string; to: string }>;
    }
  | {
      id: string;
      kind: "array";
      title: string;
      typeLabel: string;
      x: number;
      y: number;
      width: number;
      height: number;
      scale: number;
      items: TraceVisualItem[];
      edges: [];
    };

export type TraceFrame = {
  index: number;
  label: string;
  panels: TracePanel[];
  variables: Array<{ name: string; value: string }>;
  status: string;
  stdout: string;
};

export const inputConfig = `inputs = {\n  "nums": [5, 3, 8, 4],\n  "targets": [4, 8]\n}`;

export const traceFrames: TraceFrame[] = [
  {
    index: 0,
    label: "initialize",
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 16,
        scale: 1,
        items: [
          { id: "n0", label: "5", x: 14, y: 60, shape: "pill" },
          { id: "n1", label: "3", x: 36, y: 60, shape: "pill" },
          { id: "n2", label: "8", x: 58, y: 60, shape: "pill" },
          { id: "n3", label: "4", x: 80, y: 60, shape: "pill" },
        ],
        edges: [],
      },
      {
        id: "bst",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisBST",
        x: 18,
        y: 36,
        width: 52,
        height: 50,
        scale: 1,
        items: [],
        edges: [],
      },
    ],
    variables: [{ name: "max_val", value: "0" }],
    status: "Trace ready. No inserted nodes yet.",
    stdout: "stdout: run_case() started",
  },
  {
    index: 1,
    label: "insert(5)",
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 16,
        scale: 1,
        items: [
          { id: "n0", label: "5", x: 14, y: 60, shape: "pill", tone: "active" },
          { id: "n1", label: "3", x: 36, y: 60, shape: "pill" },
          { id: "n2", label: "8", x: 58, y: 60, shape: "pill" },
          { id: "n3", label: "4", x: 80, y: 60, shape: "pill" },
        ],
        edges: [],
      },
      {
        id: "bst",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisBST",
        x: 18,
        y: 36,
        width: 52,
        height: 50,
        scale: 1,
        items: [{ id: "5", label: "5", x: 50, y: 18, shape: "circle" }],
        edges: [],
      },
    ],
    variables: [
      { name: "i", value: "0" },
      { name: "max_val", value: "5" },
      { name: "current", value: "5" },
    ],
    status: "Inserted root node 5 and updated max_val.",
    stdout: "stdout: 1 frame emitted by dsviz",
  },
  {
    index: 2,
    label: "insert(3)",
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 16,
        scale: 1,
        items: [
          { id: "n0", label: "5", x: 14, y: 60, shape: "pill" },
          { id: "n1", label: "3", x: 36, y: 60, shape: "pill", tone: "active" },
          { id: "n2", label: "8", x: 58, y: 60, shape: "pill" },
          { id: "n3", label: "4", x: 80, y: 60, shape: "pill" },
        ],
        edges: [],
      },
      {
        id: "bst",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisBST",
        x: 18,
        y: 36,
        width: 52,
        height: 50,
        scale: 1,
        items: [
          { id: "5", label: "5", x: 50, y: 18, shape: "circle" },
          { id: "3", label: "3", x: 24, y: 48, shape: "circle" },
        ],
        edges: [{ from: "5", to: "3" }],
      },
    ],
    variables: [
      { name: "i", value: "1" },
      { name: "max_val", value: "5" },
      { name: "current", value: "3" },
    ],
    status: "Inserted 3 into the left subtree.",
    stdout: "stdout: 2 frames emitted by dsviz",
  },
  {
    index: 3,
    label: "insert(8)",
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 16,
        scale: 1,
        items: [
          { id: "n0", label: "5", x: 14, y: 60, shape: "pill" },
          { id: "n1", label: "3", x: 36, y: 60, shape: "pill" },
          { id: "n2", label: "8", x: 58, y: 60, shape: "pill", tone: "active" },
          { id: "n3", label: "4", x: 80, y: 60, shape: "pill" },
        ],
        edges: [],
      },
      {
        id: "bst",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisBST",
        x: 18,
        y: 36,
        width: 52,
        height: 50,
        scale: 1,
        items: [
          { id: "5", label: "5", x: 50, y: 18, shape: "circle" },
          { id: "3", label: "3", x: 24, y: 48, shape: "circle" },
          { id: "8", label: "8", x: 72, y: 48, shape: "circle" },
        ],
        edges: [
          { from: "5", to: "3" },
          { from: "5", to: "8" },
        ],
      },
      {
        id: "targets",
        kind: "array",
        title: "targets",
        typeLabel: "VisArray",
        x: 58,
        y: 14,
        width: 26,
        height: 16,
        scale: 1,
        items: [
          { id: "t0", label: "4", x: 30, y: 60, shape: "pill" },
          { id: "t1", label: "8", x: 64, y: 60, shape: "pill", tone: "active" },
        ],
        edges: [],
      },
    ],
    variables: [
      { name: "i", value: "2" },
      { name: "max_val", value: "8" },
      { name: "current", value: "8" },
    ],
    status: "Inserted 8 into the right subtree and updated max_val.",
    stdout: "stdout: 3 frames emitted by dsviz",
  },
  {
    index: 4,
    label: "insert(4)",
    panels: [
      {
        id: "nums",
        kind: "array",
        title: "nums",
        typeLabel: "VisArray",
        x: 8,
        y: 12,
        width: 42,
        height: 16,
        scale: 1,
        items: [
          { id: "n0", label: "5", x: 14, y: 60, shape: "pill" },
          { id: "n1", label: "3", x: 36, y: 60, shape: "pill" },
          { id: "n2", label: "8", x: 58, y: 60, shape: "pill" },
          { id: "n3", label: "4", x: 80, y: 60, shape: "pill", tone: "active" },
        ],
        edges: [],
      },
      {
        id: "bst",
        kind: "bst",
        title: "working tree",
        typeLabel: "VisBST",
        x: 18,
        y: 36,
        width: 52,
        height: 50,
        scale: 1,
        items: [
          { id: "5", label: "5", x: 50, y: 18, shape: "circle" },
          { id: "3", label: "3", x: 24, y: 48, shape: "circle" },
          { id: "8", label: "8", x: 72, y: 48, shape: "circle" },
          { id: "4", label: "4", x: 36, y: 78, shape: "circle" },
        ],
        edges: [
          { from: "5", to: "3" },
          { from: "5", to: "8" },
          { from: "3", to: "4" },
        ],
      },
      {
        id: "targets",
        kind: "array",
        title: "targets",
        typeLabel: "VisArray",
        x: 58,
        y: 14,
        width: 26,
        height: 16,
        scale: 1,
        items: [
          { id: "t0", label: "4", x: 30, y: 60, shape: "pill", tone: "active" },
          { id: "t1", label: "8", x: 64, y: 60, shape: "pill" },
        ],
        edges: [],
      },
    ],
    variables: [
      { name: "i", value: "3" },
      { name: "max_val", value: "8" },
      { name: "current", value: "4" },
    ],
    status: "Inserted 4 as the right child of 3.",
    stdout: "stdout: 4 frames emitted by dsviz",
  },
];
