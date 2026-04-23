"use client";

import {
  Background,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { TracePanel } from "./mock-trace";

type TreeNodeData = {
  label: string;
  tone?: "default" | "active";
};

type TreeNodeModel = Node<TreeNodeData, "treeNode">;

type TreeFlowProps = {
  panel: Extract<TracePanel, { kind: "bst" }>;
  positions: Record<string, { x: number; y: number; width?: number; height?: number; scale?: number }>;
  setPositions: Dispatch<SetStateAction<Record<string, { x: number; y: number; width?: number; height?: number; scale?: number }>>>;
};

const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
};

function itemKey(panelId: string, itemId: string) {
  return `${panelId}:${itemId}`;
}

function TreeNode({ data }: NodeProps<TreeNodeModel>) {
  const active = data.tone === "active";
  return (
    <div
      className={`relative flex h-14 w-14 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
        active
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : "border-[#d1d5db] bg-white text-[#111827]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 8, height: 8, border: "none", background: "transparent", opacity: 0 }}
      />
      <span className="select-none">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 8, height: 8, border: "none", background: "transparent", opacity: 0 }}
      />
    </div>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

export function TreeFlowViewport({ panel, positions, setPositions }: TreeFlowProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();

  const initialNodes: TreeNodeModel[] = useMemo(() => {
    if (!size.width || !size.height) return [];
    return panel.items.map((item) => ({
      id: item.id,
      type: "treeNode",
      position: {
        x: ((positions[itemKey(panel.id, item.id)]?.x ?? item.x) / 100) * size.width,
        y: ((positions[itemKey(panel.id, item.id)]?.y ?? item.y) / 100) * size.height,
      },
      data: {
        label: item.label,
        tone: item.tone,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));
  }, [panel.id, panel.items, positions, size.height, size.width]);

  const initialEdges = useMemo(
    () =>
      panel.edges.map((edge) => ({
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        type: "smoothstep" as const,
      })),
    [panel.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  return (
    <div ref={ref} className="h-full w-full">
      {size.width > 0 && size.height > 0 ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={(_event, node) => {
            setPositions((current) => ({
              ...current,
              [itemKey(panel.id, node.id)]: {
                x: (node.position.x / size.width) * 100,
                y: (node.position.y / size.height) * 100,
              },
            }));
          }}
          nodeTypes={nodeTypes}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
          minZoom={0.6}
          maxZoom={1.4}
          className="bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
        >
          <Background gap={28} size={1} color="rgba(229,231,235,0.55)" />
        </ReactFlow>
      ) : null}
    </div>
  );
}
