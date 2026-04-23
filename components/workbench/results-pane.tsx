"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { TraceFrame, TracePanel, TraceVisualItem } from "./mock-trace";

function edgeStyle(from: { x: number; y: number }, to: { x: number; y: number }) {
  const x1 = from.x;
  const y1 = from.y;
  const x2 = to.x;
  const y2 = to.y;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    left: `${x1}%`,
    top: `${y1}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "0 50%",
  };
}

type DragPositions = Record<
  string,
  { x: number; y: number; width?: number; height?: number; scale?: number }
>;

function itemKey(panelId: string, itemId: string) {
  return `${panelId}:${itemId}`;
}

function panelKey(panelId: string) {
  return `panel:${panelId}`;
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
  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const [resizingPanelId, setResizingPanelId] = useState<string | null>(null);

  useEffect(() => {
    if (!draggingPanelId && !resizingPanelId) return;

    function onPointerMove(event: PointerEvent) {
      const host = document.querySelector<HTMLElement>(`[data-canvas-root="true"]`);
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setPositions((current) => {
        const next = { ...current };

        if (draggingPanelId) {
          const currentPanel = next[panelKey(draggingPanelId)] ?? {
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            scale: panel.scale,
          };
          next[panelKey(draggingPanelId)] = {
            ...currentPanel,
            x: Math.min(78, Math.max(2, x)),
            y: Math.min(82, Math.max(4, y)),
          };
        }

        if (resizingPanelId) {
          const currentPanel = next[panelKey(resizingPanelId)] ?? {
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            scale: panel.scale,
          };
          const width = Math.min(70, Math.max(18, x - currentPanel.x));
          const ratio = width / panel.width;
          next[panelKey(resizingPanelId)] = {
            ...currentPanel,
            width,
            height: panel.height * ratio,
            scale: Math.min(1.8, Math.max(0.7, panel.scale * ratio)),
          };
        }

        return next;
      });
    }

    function onPointerUp() {
      setDraggingPanelId(null);
      setResizingPanelId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingPanelId, resizingPanelId, panel.height, panel.scale, panel.width, panel.x, panel.y, setPositions]);

  const itemMap = useMemo(
    () =>
      new Map(
        panel.items.map((item) => {
          const key = itemKey(panel.id, item.id);
          return [item.id, positions[key] ?? { x: item.x, y: item.y }];
        }),
      ),
    [panel.id, panel.items, positions],
  );
  const currentPanelPosition = positions[panelKey(panel.id)] ?? {
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    scale: panel.scale,
  };
  const currentScale = currentPanelPosition.scale ?? panel.scale;

  return (
    <article
      className="absolute overflow-hidden rounded-xl border border-[#d6d9df] bg-white shadow-sm"
      style={{
        left: `${currentPanelPosition.x}%`,
        top: `${currentPanelPosition.y}%`,
        width: `${currentPanelPosition.width ?? panel.width}%`,
        height: `${currentPanelPosition.height ?? panel.height}%`,
      }}
    >
      <div
        onPointerDown={() => setDraggingPanelId(panel.id)}
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
        className={`relative h-[calc(100%-37px)] overflow-hidden p-2 ${
          panel.kind === "bst"
            ? "bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
            : "bg-[#fcfcfd]"
        }`}
      >
        <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${currentScale})` }}>
        {panel.kind === "bst"
          ? panel.edges.map((edge) => {
              const from = itemMap.get(edge.from);
              const to = itemMap.get(edge.to);
              if (!from || !to) return null;

              return (
                <div
                  key={`${panel.id}-${edge.from}-${edge.to}`}
                  className="absolute h-px bg-stone-500/60"
                  style={edgeStyle(
                    { x: from.x, y: from.y },
                    { x: to.x, y: to.y },
                  )}
                />
              );
            })
          : null}

        {panel.items.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#d1d5db] text-sm text-[#6b7280]">
            No objects yet for this step.
          </div>
        ) : null}

        {panel.items.map((item) => {
          const key = itemKey(panel.id, item.id);
          const current = positions[key] ?? { x: item.x, y: item.y };
          const isCircle = item.shape !== "pill";
          return (
            <div
              key={key}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border text-sm font-semibold shadow-sm ${
                isCircle
                  ? "h-14 w-14 rounded-full"
                  : "h-12 min-w-16 rounded-xl px-4 py-3"
              } ${
                item.tone === "active"
                  ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
                  : "border-[#d1d5db] bg-white text-[#111827]"
              }`}
              style={{ left: `${current.x}%`, top: `${current.y}%` }}
            >
              {item.label}
            </div>
          );
        })}
        </div>
        <button
          type="button"
          onPointerDown={() => setResizingPanelId(panel.id)}
          className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-[#d1d5db] bg-white"
          aria-label={`Resize ${panel.title}`}
        />
      </div>
    </article>
  );
}

export function ResultsPane({
  frame,
  totalFrames,
  onPrev,
  onNext,
}: {
  frame: TraceFrame;
  totalFrames: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [positions, setPositions] = useState<DragPositions>({});

  useEffect(() => {
    const nextPositions: DragPositions = {};
    for (const panel of frame.panels) {
      nextPositions[panelKey(panel.id)] = {
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        scale: panel.scale,
      };
      for (const item of panel.items) {
        nextPositions[itemKey(panel.id, item.id)] = { x: item.x, y: item.y };
      }
    }
    setPositions(nextPositions);
  }, [frame]);

  return (
    <section className="relative flex min-h-[720px] min-w-0 flex-1 overflow-hidden rounded-xl border border-[#d1d5db] bg-[#fafafa] shadow-sm">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white/95 p-2 shadow-sm backdrop-blur">
        <button
          onClick={onPrev}
          disabled={frame.index === 0}
          className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={frame.index === totalFrames - 1}
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
          <div className="rounded-lg border border-[#d1fae5] bg-[#ecfdf5] px-3 py-3 text-[#065f46]">
            {frame.status}
          </div>
          <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 font-mono text-xs text-[#374151]">
            {frame.stdout}
          </div>
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
