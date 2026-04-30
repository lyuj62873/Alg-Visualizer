"use client";

import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import { useEffect, useRef, useState } from "react";
import { TraceArrayCell, TraceFrame, TracePanel } from "./mock-trace";
import { NodeFlowViewport } from "./tree-flow";

function isNodeFlowKind(
  panel: TracePanel,
): panel is Extract<TracePanel, { kind: "bst" | "list" }> {
  return panel.kind === "bst" || panel.kind === "list";
}

type DragPositions = Record<
  string,
  { x: number; y: number; width?: number; height?: number; scale?: number }
>;

type PanelPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

type InteractionState = {
  mode: "drag" | "resize";
  panelId: string;
  panelKind: TracePanel["kind"];
  startClientX: number;
  startClientY: number;
  panelStart: PanelPosition;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function panelKey(panelId: string) {
  return `panel:${panelId}`;
}

function setPanelScale(
  setPositions: Dispatch<SetStateAction<DragPositions>>,
  panel: TracePanel,
  nextScale: number,
) {
  setPositions((current) => {
    const key = panelKey(panel.id);
    const prior = current[key] ?? {
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      scale: panel.scale,
    };

    return {
      ...current,
      [key]: {
        ...prior,
        scale: clamp(nextScale, 0.75, 1.9),
      },
    };
  });
}

function getEffectiveMinSize(panel: TracePanel) {
  return {
    width: panel.minWidth ?? panel.width,
    height: panel.minHeight ?? panel.height,
  };
}

function getEffectiveMaxSize(panel: TracePanel) {
  return {
    width: panel.maxWidth ?? 96,
    height: panel.maxHeight ?? 96,
  };
}

function getPanelPosition(panel: TracePanel, positions: DragPositions): PanelPosition {
  const current = positions[panelKey(panel.id)] ?? {
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    scale: panel.scale,
  };
  const scale = current.scale ?? panel.scale;
  const minSize = getEffectiveMinSize(panel);
  const maxSize = getEffectiveMaxSize(panel);

  return {
    x: current.x,
    y: current.y,
    width: clamp(current.width ?? panel.width, minSize.width, maxSize.width),
    height: clamp(current.height ?? panel.height, minSize.height, maxSize.height),
    scale,
  };
}

function formatDimensions(dimensions?: number[]) {
  return dimensions && dimensions.length ? dimensions.join(" x ") : null;
}

function ArrayValueCell({ cell }: { cell: Extract<TraceArrayCell, { kind: "value" }> }) {
  const isActive = cell.tone === "active";
  const containsActive = !!cell.containsActive;

  return (
    <div
      className={`flex min-h-10 min-w-[52px] items-center justify-center rounded-lg border px-2.5 py-2 text-[13px] font-semibold shadow-sm ${
        isActive
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : containsActive
            ? "border-[#fdba74] bg-[#fffbeb] text-[#9a3412]"
            : "border-[#d1d5db] bg-white text-[#111827]"
      }`}
    >
      <span className="whitespace-nowrap">{cell.label}</span>
    </div>
  );
}

function ArrayContentView({
  layout,
  cells,
  depth,
}: {
  layout: "row" | "matrix" | "stack";
  cells: TraceArrayCell[];
  depth: number;
}) {
  if (layout === "matrix") {
    return (
      <div className="space-y-1.5">
        {cells.map((row, rowIndex) => {
          if (row.kind === "array") {
            return (
              <div key={row.id} className="flex items-center gap-1.5">
                <div className="w-5 text-right text-[10px] font-semibold text-[#94a3b8]">
                  {rowIndex}
                </div>
                <div className="flex min-w-max items-start gap-1.5">
                  {row.cells.map((child) => (
                    <ArrayCellView key={child.id} cell={child} depth={depth + 1} />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={row.id} className="flex items-center gap-1.5">
              <div className="w-5 text-right text-[10px] font-semibold text-[#94a3b8]">
                {rowIndex}
              </div>
              <ArrayCellView cell={row} depth={depth + 1} />
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === "stack") {
    return (
      <div className="space-y-2">
        {cells.map((child, index) => (
          <div key={child.id} className="rounded-xl border border-[#e2e8f0] bg-white/70 px-2.5 py-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Slice {index}
            </div>
            <ArrayCellView cell={child} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-w-max items-start gap-1.5 pb-1">
      {cells.map((child) => (
        <ArrayCellView key={child.id} cell={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function ArrayCellView({
  cell,
  depth,
}: {
  cell: TraceArrayCell;
  depth: number;
}) {
  const nestedBg = depth % 2 === 0 ? "bg-[#fffaf5]" : "bg-white";
  if (cell.kind === "value") {
    return <ArrayValueCell cell={cell} />;
  }

  const isActive = cell.tone === "active";
  const containsActive = !!cell.containsActive;
  const dimensionsLabel = formatDimensions(cell.dimensions);
  const layout = cell.layout ?? "row";

  return (
    <div
      className={`rounded-xl border px-2.5 py-2.5 shadow-sm ${nestedBg} ${
        isActive
          ? "border-[#fb923c] ring-1 ring-[#fdba74]"
          : containsActive
            ? "border-[#fdba74]"
            : "border-[#e5e7eb]"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
        <span>
          {layout === "matrix" ? "Matrix" : layout === "stack" ? "Nested Blocks" : "Nested Array"}
        </span>
        {dimensionsLabel ? <span>{dimensionsLabel}</span> : null}
      </div>
      {cell.cells.length ? (
        <ArrayContentView layout={layout} cells={cell.cells} depth={depth} />
      ) : (
        <div className="rounded-lg border border-dashed border-[#d1d5db] px-3 py-2 text-xs text-[#6b7280]">
          Empty
        </div>
      )}
    </div>
  );
}

function ArrayPanelBody({
  panel,
  scale,
  setPositions,
}: {
  panel: Extract<TracePanel, { kind: "array" }>;
  scale: number;
  setPositions: Dispatch<SetStateAction<DragPositions>>;
}) {
  const dimensionsLabel = formatDimensions(panel.dimensions);
  const layout = panel.layout ?? "row";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dragScroll, setDragScroll] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    const zoomStep = delta > 0 ? -0.08 : 0.08;
    setPanelScale(setPositions, panel, scale + zoomStep);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;

    setDragScroll({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    });
    container.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragScroll || dragScroll.pointerId !== event.pointerId) return;
    const container = scrollRef.current;
    if (!container) return;

    container.scrollLeft = dragScroll.scrollLeft - (event.clientX - dragScroll.startClientX);
    container.scrollTop = dragScroll.scrollTop - (event.clientY - dragScroll.startClientY);
  }

  function endPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    if (container && dragScroll?.pointerId === event.pointerId && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    setDragScroll(null);
  }

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      className={`absolute inset-0 overflow-auto p-3 ${
        dragScroll ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div
        className="inline-block min-w-full origin-top-left align-top"
        style={{
          zoom: scale,
        }}
      >
        {panel.cells.length ? (
          <div className="min-w-max pb-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              <span>
                {layout === "matrix" ? "2D Array" : layout === "stack" ? "Multi-D Array" : "Array"}
              </span>
              <div className="flex items-center gap-2">
                {dimensionsLabel ? <span>{dimensionsLabel}</span> : null}
                <span>{Math.round(scale * 100)}%</span>
              </div>
            </div>
            <ArrayContentView layout={layout} cells={panel.cells} depth={0} />
          </div>
        ) : (
          <div className="flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-[#d1d5db] text-sm text-[#6b7280]">
            No objects yet for this step.
          </div>
        )}
      </div>
    </div>
  );
}

function VisualizationPanel({
  panel,
  positions,
  setPositions,
}: {
  panel: TracePanel;
  positions: DragPositions;
  setPositions: Dispatch<SetStateAction<DragPositions>>;
}) {
  const currentPanelPosition = getPanelPosition(panel, positions);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  useEffect(() => {
    if (!interaction) return;
    const activeInteraction = interaction;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = activeInteraction.mode === "drag" ? "grabbing" : "se-resize";

    function onPointerMove(event: PointerEvent) {
      const host = document.querySelector<HTMLElement>('[data-canvas-root="true"]');
      if (!host) return;

      event.preventDefault();

      const rect = host.getBoundingClientRect();
      const dxPct = ((event.clientX - activeInteraction.startClientX) / rect.width) * 100;
      const dyPct = ((event.clientY - activeInteraction.startClientY) / rect.height) * 100;

      setPositions((current) => {
        const next = { ...current };

        if (activeInteraction.mode === "drag") {
          const maxX = Math.max(2, 98 - activeInteraction.panelStart.width);
          const maxY = Math.max(4, 96 - activeInteraction.panelStart.height);
          next[panelKey(activeInteraction.panelId)] = {
            ...activeInteraction.panelStart,
            x: clamp(activeInteraction.panelStart.x + dxPct, 2, maxX),
            y: clamp(activeInteraction.panelStart.y + dyPct, 4, maxY),
          };
          return next;
        }

        const startWidth = activeInteraction.panelStart.width;
        const startHeight = activeInteraction.panelStart.height;
        const nextWidth = clamp(
          startWidth + dxPct,
          activeInteraction.minWidth,
          Math.max(
            activeInteraction.minWidth,
            Math.min(activeInteraction.maxWidth, 96 - activeInteraction.panelStart.x),
          ),
        );
        const maxHeight = Math.max(
          activeInteraction.minHeight,
          Math.min(activeInteraction.maxHeight, 96 - activeInteraction.panelStart.y),
        );

        if (activeInteraction.panelKind === "array") {
          const nextHeight = clamp(
            startHeight + dyPct,
            activeInteraction.minHeight,
            maxHeight,
          );

          next[panelKey(activeInteraction.panelId)] = {
            ...activeInteraction.panelStart,
            width: nextWidth,
            height: nextHeight,
          };
          return next;
        }

        const ratio = startWidth > 0 ? nextWidth / startWidth : 1;
        const nextHeight = clamp(startHeight * ratio, activeInteraction.minHeight, maxHeight);

        next[panelKey(activeInteraction.panelId)] = {
          ...activeInteraction.panelStart,
          width: nextWidth,
          height: nextHeight,
        };
        return next;
      });
    }

    function onPointerUp() {
      setInteraction(null);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [interaction, setPositions]);

  function startInteraction(
    event: ReactPointerEvent<HTMLElement>,
    mode: InteractionState["mode"],
  ) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const minSize = getEffectiveMinSize(panel);
    const maxSize = getEffectiveMaxSize(panel);
    setInteraction({
      mode,
      panelId: panel.id,
      panelKind: panel.kind,
      startClientX: event.clientX,
      startClientY: event.clientY,
      panelStart: currentPanelPosition,
      minWidth: minSize.width,
      minHeight: minSize.height,
      maxWidth: maxSize.width,
      maxHeight: maxSize.height,
    });
  }

  return (
    <article
      className="absolute overflow-hidden rounded-xl border border-[#d6d9df] bg-white shadow-sm"
      style={{
        left: `${currentPanelPosition.x}%`,
        top: `${currentPanelPosition.y}%`,
        width: `${currentPanelPosition.width}%`,
        height: `${currentPanelPosition.height}%`,
      }}
    >
      <div
        onPointerDown={(event) => startInteraction(event, "drag")}
        className="flex cursor-grab items-center justify-between border-b border-[#f3f4f6] bg-white/95 px-3 py-2 text-xs active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-[#111827]">{panel.title}</span>
          <span className="rounded-md bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] text-[#6b7280]">
            {panel.typeLabel}
          </span>
        </div>
        <span className="text-[10px] text-[#6b7280]">drag</span>
      </div>
      <div
        className={`relative h-[calc(100%-37px)] overflow-hidden ${
          panel.kind === "bst"
            ? "bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
            : "bg-[#fcfcfd]"
        }`}
      >
        {isNodeFlowKind(panel) ? (
          <NodeFlowViewport
            panel={panel}
            scale={currentPanelPosition.scale}
            onScaleChange={(nextScale) => setPanelScale(setPositions, panel, nextScale)}
          />
        ) : (
          <ArrayPanelBody
            panel={panel as Extract<TracePanel, { kind: "array" }>}
            scale={currentPanelPosition.scale}
            setPositions={setPositions}
          />
        )}
        <button
          type="button"
          onPointerDown={(event) => startInteraction(event, "resize")}
          className="absolute bottom-1.5 right-1.5 z-10 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-[#d1d5db] bg-white"
          aria-label={`Resize ${panel.title}`}
        />
      </div>
    </article>
  );
}

export function ResultsPane({
  frame,
  totalFrames,
  phase,
  errorInfo,
  onPrev,
  onNext,
}: {
  frame: TraceFrame;
  totalFrames: number;
  phase: "idle" | "running" | "ready" | "error";
  errorInfo: { errorType: string; message: string; traceback: string; line: number | null } | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [positions, setPositions] = useState<DragPositions>({});

  useEffect(() => {
    setPositions((current) => {
      const nextPositions: DragPositions = {};

      for (const panel of frame.panels) {
        const prior = current[panelKey(panel.id)] ?? {
          x: panel.x,
          y: panel.y,
          width: panel.width,
          height: panel.height,
          scale: panel.scale,
        };
        const scale = prior.scale ?? panel.scale;
        const minSize = getEffectiveMinSize(panel);
        const maxSize = getEffectiveMaxSize(panel);

        nextPositions[panelKey(panel.id)] = {
          x: prior.x,
          y: prior.y,
          width: clamp(prior.width ?? panel.width, minSize.width, maxSize.width),
          height: clamp(prior.height ?? panel.height, minSize.height, maxSize.height),
          scale,
        };

        if (!isNodeFlowKind(panel)) {
          continue;
        }

      }

      return nextPositions;
    });
  }, [frame]);

  return (
    <section className="relative flex min-h-[720px] min-w-0 flex-1 overflow-hidden rounded-xl border border-[#d1d5db] bg-[#fafafa] shadow-sm">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white/95 p-2 shadow-sm backdrop-blur">
        <button
          onClick={onPrev}
          disabled={phase === "running" || frame.index === 0}
          className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={phase === "running" || frame.index === totalFrames - 1}
          className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
        <div className="rounded-md bg-[#f3f4f6] px-3 py-2 text-sm text-[#4b5563]">
          {frame.index + 1} / {totalFrames}
        </div>
      </div>

      <aside className="absolute right-4 top-20 z-20 w-[240px] rounded-xl border border-[#e5e7eb] bg-white/96 shadow-sm backdrop-blur">
        <div className="border-b border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
          Variables
        </div>
        <div className="space-y-2 p-4">
          {frame.variables.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 text-sm"
            >
              <span className="font-medium text-[#374151]">{item.name}</span>
              <span className="font-mono text-[#111827]">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
          Output
        </div>
        <div className="space-y-3 p-4 text-sm text-[#4b5563]">
          {phase === "error" && errorInfo ? (
            <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-[#7f1d1d]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dc2626]">
                Runtime error
              </div>
              <div className="mt-2 text-sm font-semibold text-[#991b1b]">
                {errorInfo.errorType}
              </div>
              <div className="mt-1 text-sm text-[#7f1d1d]">
                {errorInfo.message}
              </div>
              {errorInfo.line ? (
                <div className="mt-2 text-xs font-medium text-[#b91c1c]">
                  Line {errorInfo.line}
                </div>
              ) : null}
              <details className="mt-3 rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-xs text-[#7f1d1d]">
                <summary className="cursor-pointer select-none font-medium text-[#b91c1c]">
                  Traceback
                </summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-[#7f1d1d]">
                  {errorInfo.traceback}
                </pre>
              </details>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-[#d1fae5] bg-[#ecfdf5] px-3 py-3 text-[#065f46]">
                {frame.status}
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 font-mono text-xs text-[#374151]">
                {frame.stdout}
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-hidden p-0">
        <div
          data-canvas-root="true"
          className="relative h-full min-h-[720px] w-full bg-[linear-gradient(#fcfcfd,#f8fafc)]"
        >
          {frame.panels.map((panel) => (
            <VisualizationPanel
              key={panel.id}
              panel={panel}
              positions={positions}
              setPositions={setPositions}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
