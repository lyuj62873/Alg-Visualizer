"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[#9ca3af]">
      Loading editor...
    </div>
  ),
});

export function EditorPane({
  code,
  onCodeChange,
  onResetCode,
  activeLine,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  onResetCode: () => void;
  activeLine?: number | null;
}) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [editorHeightPx, setEditorHeightPx] = useState(640);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;

    const update = () => {
      const next = Math.max(320, Math.floor(host.clientHeight));
      setEditorHeightPx(next);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  function applyLineHighlight(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monacoApi: typeof Monaco | null,
    line: number | null | undefined,
  ) {
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    if (!monacoApi || !line || line < 1) return;

    decorationIdsRef.current = editor.deltaDecorations([], [
      {
        range: new monacoApi.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "algolens-active-line",
          linesDecorationsClassName: "algolens-active-line-marker",
        },
      },
    ]);
    editor.revealLineInCenterIfOutsideViewport(line);
  }

  function handleEditorMount(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monacoApi: typeof Monaco,
  ) {
    editorRef.current = editor;
    monacoRef.current = monacoApi;
    applyLineHighlight(editor, monacoApi, activeLine);
    editor.onKeyDown((event) => {
      if (
        event.browserEvent.code === "Space" &&
        !event.browserEvent.altKey &&
        !event.browserEvent.ctrlKey &&
        !event.browserEvent.metaKey
      ) {
        event.browserEvent.preventDefault();
        editor.trigger("keyboard", "type", { text: " " });
      }
    });
  }

  useEffect(() => {
    if (!editorRef.current) return;
    applyLineHighlight(editorRef.current, monacoRef.current, activeLine);
  }, [activeLine]);

  return (
    <section className="flex h-full min-h-[720px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-[#1e1e1e] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#262626] px-4 py-3 text-sm text-[#d1d5db]">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-[#111827] px-2 py-1 text-xs font-medium text-[#9ca3af]">
            solution.py
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <button
            type="button"
            onClick={onResetCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#232323] px-2 py-1 text-xs text-[#d1d5db] hover:bg-[#2b2b2b]"
            title="Reset to the default Solution / run_case() template"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 3v4H9" />
              <path d="M13 7a5 5 0 1 1-1.46-3.54L13 5" />
            </svg>
            Reset
          </button>
        </div>
      </div>

      <div ref={editorHostRef} className="h-[640px] flex-1 overflow-hidden xl:h-full">
        <MonacoEditor
          height={`${editorHeightPx}px`}
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => onCodeChange(value ?? "")}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            fontSize: 13,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            renderLineHighlight: "line",
            tabSize: 4,
          }}
        />
      </div>
    </section>
  );
}
