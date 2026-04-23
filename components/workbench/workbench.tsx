"use client";

import { useEffect, useState } from "react";
import { EditorPane } from "./editor-pane";
import { codeSample, inputConfig, traceFrames } from "./mock-trace";
import { ResultsPane } from "./results-pane";

export function Workbench() {
  const [activeFrameIndex, setActiveFrameIndex] = useState(3);
  const [leftPaneWidth, setLeftPaneWidth] = useState(33.333);
  const [isResizing, setIsResizing] = useState(false);
  const activeFrame = traceFrames[activeFrameIndex];

  useEffect(() => {
    if (!isResizing) return;

    function handlePointerMove(event: PointerEvent) {
      const next = (event.clientX / window.innerWidth) * 100;
      setLeftPaneWidth(Math.min(72, Math.max(28, next)));
    }

    function handlePointerUp() {
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-[#262626]">
      <div className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-semibold text-white">
              AlgoLens
            </div>
            <nav className="hidden items-center gap-5 text-sm text-[#6b7280] md:flex">
              <span className="font-medium text-[#111827]">Workbench</span>
              <span>Trace</span>
              <span>Examples</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1.5 text-xs text-[#6b7280]">
              Python / Pyodide
            </div>
            <button className="rounded-lg bg-[#ffa116] px-4 py-2 text-sm font-semibold text-white">
              Run Trace
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 xl:h-[calc(100vh-65px)] xl:flex-row xl:overflow-hidden">
        <div className="hidden xl:block" style={{ width: `${leftPaneWidth}%` }}>
          <EditorPane code={codeSample} inputConfig={inputConfig} />
        </div>
        <button
          type="button"
          aria-label="Resize panes"
          onPointerDown={() => setIsResizing(true)}
          className="hidden w-3 shrink-0 cursor-col-resize rounded-full bg-transparent xl:flex xl:items-center xl:justify-center"
        >
          <span className="h-20 w-1 rounded-full bg-[#d1d5db]" />
        </button>
        <ResultsPane
          frame={activeFrame}
          totalFrames={traceFrames.length}
          onPrev={() => setActiveFrameIndex((current) => Math.max(0, current - 1))}
          onNext={() =>
            setActiveFrameIndex((current) =>
              Math.min(traceFrames.length - 1, current + 1),
            )
          }
        />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 pb-4 sm:px-6 xl:hidden">
        <EditorPane code={codeSample} inputConfig={inputConfig} />
      </div>
    </main>
  );
}
