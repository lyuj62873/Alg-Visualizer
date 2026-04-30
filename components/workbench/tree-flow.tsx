"use client";

import {
  Background,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowInstance,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TracePanel } from "./mock-trace";

type TreeNodeData = {
  label: string;
  tone?: "default" | "active";
};

type TreeNodeModel = Node<TreeNodeData, "treeNode">;

type TreeFlowProps = {
  panel: Extract<TracePanel, { kind: "bst" }>;
};

const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
};

const TREE_LAYOUT_WIDTH = 320;
const TREE_LAYOUT_HEIGHT = 240;

function TreeNode({ data }: NodeProps<TreeNodeModel>) {
  const active = data.tone === "active";
  return (
    <div
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm ${
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

export function TreeFlowViewport({ panel }: TreeFlowProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const flowRef = useRef<Pick<ReactFlowInstance<any, any>, "fitView"> | null>(null);
  const lastFitSignatureRef = useRef<string | null>(null);

  const initialNodes: TreeNodeModel[] = useMemo(() => {
    return panel.items.map((item) => ({
      id: item.id,
      type: "treeNode",
      position: {
        x: (item.x / 100) * TREE_LAYOUT_WIDTH,
        y: (item.y / 100) * TREE_LAYOUT_HEIGHT,
      },
      data: {
        label: item.label,
        tone: item.tone,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));
  }, [panel.items]);

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

  const layoutSignature = useMemo(
    () =>
      JSON.stringify({
        items: panel.items.map((item) => [item.id, item.x, item.y]),
        edges: panel.edges,
      }),
    [panel.edges, panel.items],
  );

  useEffect(() => {
    if (!flowRef.current || !size.width || !size.height || !panel.items.length) return;
    if (lastFitSignatureRef.current === layoutSignature) return;

    const rafId = window.requestAnimationFrame(() => {
      flowRef.current?.fitView({
        padding: 0.14,
        duration: 180,
        minZoom: 0.5,
        maxZoom: 0.95,
      });
      lastFitSignatureRef.current = layoutSignature;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [layoutSignature, panel.items.length, size.height, size.width]);

  return (
    <div ref={ref} className="h-full w-full">
      {size.width > 0 && size.height > 0 ? (
        <ReactFlow
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          selectionOnDrag={false}
          zoomOnScroll
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={1.5}
          className="bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
        >
          <Background gap={16} size={1} color="rgba(229,231,235,0.42)" />
        </ReactFlow>
      ) : null}
    </div>
  );
}
