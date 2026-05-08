"use client";

import { useEffect, useRef, useState } from "react";
import { EditorPane } from "./editor-pane";
import { codeSample, TraceFrame } from "./mock-trace";
import { runMockTrace } from "./mock-runner";
import {
  cancelPyodideTrace,
  PyodideRunCancelledError,
  PyodideRunTimeoutError,
  PyodideUnavailableError,
  runPyodideTrace,
} from "./pyodide-runner";
import { ResultsPane } from "./results-pane";

type RunErrorDetail = {
  errorType: string;
  message: string;
  traceback: string;
  line: number | null;
};

const emptyTraceFrame: TraceFrame = {
  index: 0,
  label: "idle",
  line: null,
  panels: [],
  variables: [],
  status: "Select an example or click Run Trace.",
  stdout: "",
};

export function Workbench() {
  const runIdRef = useRef(0);
  const [phase, setPhase] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [code, setCode] = useState(codeSample);
  const [frames, setFrames] = useState<TraceFrame[]>([emptyTraceFrame]);
  const [leftPaneWidth, setLeftPaneWidth] = useState(33.333);
  const [isResizing, setIsResizing] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [runError, setRunError] = useState<RunErrorDetail | null>(null);
  const activeFrame = frames[activeFrameIndex] ?? frames[0];

  function cancelActiveRun(nextPhase: "idle" | "error" = "idle") {
    runIdRef.current += 1;
    cancelPyodideTrace();
    setPhase(nextPhase);
  }

  const exampleItems = [
    {
      label: "Balanced Rebuild",
      description: "inorder collect, quicksort, then rebuild a balanced tree",
      path: "/examples/balanced-rebuild-example.py",
    },
    {
      label: "Delete Duplicates",
      description: "remove adjacent duplicates from a sorted linked list in place",
      path: "/examples/reverse-linked-list-example.py",
    },
    {
      label: "Multi Panel",
      description: "independent trees and lists render in separate visualization panels",
      path: "/examples/multi-panel-example.py",
    },
  ];

  const guideItems = [
    {
      label: "VisArray",
      description: "array init, append, insert, get/set, delete, reverse",
      path: "/examples/vis-array-example.py",
    },
    {
      label: "VisArray 2D/3D",
      description: "matrix and nested-list mutations with tracked inner updates",
      path: "/examples/vis-array-multidim-example.py",
    },
    {
      label: "VisTreeNode",
      description: "node init, set/get, attach/detach children",
      path: "/examples/vis-tree-node-example.py",
    },
    {
      label: "VisListNode",
      description: "linked-list init, insert, rewire next pointers, replace tail",
      path: "/examples/vis-list-node-example.py",
    },
  ];

  async function loadExample(path: string) {
    cancelActiveRun("idle");
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load example: ${path}`);
    }
    const nextCode = await response.text();
    setCode(nextCode);
    setFrames([emptyTraceFrame]);
    setActiveFrameIndex(0);
    setPhase("idle");
    setRunError(null);
    setExamplesOpen(false);
    setGuidesOpen(false);
  }

  async function handleRunTrace() {
    const runId = ++runIdRef.current;
    setPhase("running");
    setRunError(null);

    try {
      let result;
      try {
        result = await runPyodideTrace(code);
      } catch (err) {
        // Only fall back to mock when Pyodide isn't available at all.
        if (err instanceof PyodideUnavailableError) {
          result = await runMockTrace(code);
        } else {
          throw err;
        }
      }
      if (runId !== runIdRef.current) return;

      if (result.kind === "error") {
        setFrames([
          {
            index: 0,
            label: "error",
            line: result.line,
            panels: [],
            variables: [],
            status: `Error: ${result.errorType}`,
            stdout: result.traceback,
          },
        ]);
        setActiveFrameIndex(0);
        setRunError({
          errorType: result.errorType,
          message: result.message,
          traceback: result.traceback,
          line: result.line,
        });
        setPhase("error");
        return;
      }

      if (!result.frames.length) {
        throw new Error("No frames emitted. Ensure dsviz emits at least one snapshot.");
      }

      setFrames(result.frames);
      setActiveFrameIndex(0);
      setPhase("ready");
    } catch (error) {
      if (runId !== runIdRef.current) return;

      if (error instanceof PyodideRunCancelledError) {
        setPhase("idle");
        return;
      }

      const isTimeout = error instanceof PyodideRunTimeoutError;
      const message = isTimeout
        ? "Please check your code for an infinite loop, or try reducing unnecessary visualization."
        : error instanceof Error
          ? error.message
          : String(error);
      const traceback = isTimeout
        ? "User code exceeded the 30-second execution limit and the Pyodide worker was terminated."
        : message;
      const errorType = isTimeout
        ? "ExecutionTimeout"
        : error instanceof Error
          ? error.name
          : "Error";

      setRunError({
        errorType,
        message,
        traceback,
        line: null,
      });
      setFrames([
        {
          index: 0,
          label: "error",
          line: null,
          panels: [],
          variables: [],
          status: `Error: ${message}`,
          stdout: isTimeout ? traceback : `stderr: ${message}`,
        },
      ]);
      setActiveFrameIndex(0);
      setPhase("error");
    }
  }

  useEffect(() => {
    return () => {
      cancelPyodideTrace();
    };
  }, []);

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
              <div
                className="relative"
                onMouseEnter={() => setExamplesOpen(true)}
                onMouseLeave={() => setExamplesOpen(false)}
              >
                <button
                  type="button"
                  className="font-medium text-[#111827]"
                >
                  Examples
                </button>
                {examplesOpen ? (
                  <div
                    className="absolute left-0 top-full z-30 w-80 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg"
                    onMouseEnter={() => setExamplesOpen(true)}
                  >
                    {exampleItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          void loadExample(item.path);
                        }}
                        className="flex w-full flex-col gap-1 border-b border-[#f3f4f6] px-4 py-3 text-left last:border-b-0 hover:bg-[#f9fafb]"
                      >
                        <span className="text-sm font-semibold text-[#111827]">
                          {item.label}
                        </span>
                        <span className="text-xs leading-5 text-[#6b7280]">
                          {item.description}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div
                className="relative"
                onMouseEnter={() => setGuidesOpen(true)}
                onMouseLeave={() => setGuidesOpen(false)}
              >
                <button
                  type="button"
                  className="font-medium text-[#111827]"
                >
                  Guides
                </button>
                {guidesOpen ? (
                  <div
                    className="absolute left-0 top-full z-30 w-80 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg"
                    onMouseEnter={() => setGuidesOpen(true)}
                  >
                    {guideItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          void loadExample(item.path);
                        }}
                        className="flex w-full flex-col gap-1 border-b border-[#f3f4f6] px-4 py-3 text-left last:border-b-0 hover:bg-[#f9fafb]"
                      >
                        <span className="text-sm font-semibold text-[#111827]">
                          {item.label}
                        </span>
                        <span className="text-xs leading-5 text-[#6b7280]">
                          {item.description}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1.5 text-xs text-[#6b7280]">
              Python / Pyodide
            </div>
            <button
              onClick={handleRunTrace}
              disabled={phase === "running"}
              className="rounded-lg bg-[#ffa116] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "running" ? "Running..." : "Run Trace"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 xl:h-[calc(100vh-65px)] xl:flex-row xl:overflow-hidden">
        <div className="hidden h-full xl:block" style={{ width: `${leftPaneWidth}%` }}>
          <EditorPane
            code={code}
            onCodeChange={setCode}
            onResetCode={() => {
              cancelActiveRun("idle");
              setCode(codeSample);
            }}
            activeLine={activeFrame.line}
          />
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
          totalFrames={frames.length}
          phase={phase}
          errorInfo={runError}
          onPrev={() => setActiveFrameIndex((current) => Math.max(0, current - 1))}
          onNext={() =>
            setActiveFrameIndex((current) =>
              Math.min(frames.length - 1, current + 1),
            )
          }
        />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 pb-4 sm:px-6 xl:hidden">
        <EditorPane
          code={code}
          onCodeChange={setCode}
          onResetCode={() => {
            cancelActiveRun("idle");
            setCode(codeSample);
          }}
          activeLine={activeFrame.line}
        />
      </div>
    </main>
  );
}
