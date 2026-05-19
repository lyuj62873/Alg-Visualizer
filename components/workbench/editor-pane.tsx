"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

const VISUALIZE_MARKER_COMMENT = "# algolens: visualize";
const assignmentPrefixes = [
  "if ",
  "elif ",
  "while ",
  "for ",
  "return",
  "assert ",
  "raise ",
  "import ",
  "from ",
  "with ",
  "class ",
  "def ",
  "@",
];
const augmentedAssignmentPattern =
  /^\s*[A-Za-z_][A-Za-z0-9_]*\s*(\+=|-=|\*=|\/=|%=|\/\/=|\*\*=|&=|\|=|\^=|>>=|<<=)\s*.+$/;
const simpleAssignmentPattern =
  /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*.+$/;

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
  enableVisualizationMarkers = false,
  readOnly = false,
  markerOnlyMode = false,
  fixedHeight = false,
  showResetButton = true,
  fileLabel = "solution.py",
  minHeightPx = 720,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  onResetCode: () => void;
  activeLine?: number | null;
  enableVisualizationMarkers?: boolean;
  readOnly?: boolean;
  markerOnlyMode?: boolean;
  fixedHeight?: boolean;
  showResetButton?: boolean;
  fileLabel?: string;
  minHeightPx?: number;
}) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [editorHeightPx, setEditorHeightPx] = useState(640);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const activeDecorationIdsRef = useRef<string[]>([]);
  const markerDecorationIdsRef = useRef<string[]>([]);
  const markerEditInProgressRef = useRef(false);
  const latestCodeRef = useRef(code);

  useEffect(() => {
    latestCodeRef.current = code;
  }, [code]);

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

  const fixedHeightStyle = fixedHeight || markerOnlyMode
    ? { height: `${minHeightPx}px`, minHeight: `${minHeightPx}px` }
    : { minHeight: `${minHeightPx}px` };

  function getLineIndentation(line: string) {
    const match = line.match(/^\s*/);
    return match?.[0] ?? "";
  }

  function stripInlineComment(line: string) {
    const hashIndex = line.indexOf("#");
    if (hashIndex === -1) {
      return line;
    }
    return line.slice(0, hashIndex);
  }

  function isVisualizationCandidateLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return false;
    }
    if (assignmentPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
      return false;
    }

    const withoutComment = stripInlineComment(line).trimEnd();
    if (!withoutComment) {
      return false;
    }

    if (augmentedAssignmentPattern.test(withoutComment)) {
      return true;
    }

    if (!simpleAssignmentPattern.test(withoutComment)) {
      return false;
    }

    if (
      withoutComment.includes("==") ||
      withoutComment.includes("!=") ||
      withoutComment.includes("<=") ||
      withoutComment.includes(">=")
    ) {
      return false;
    }

    return true;
  }

  function hasVisualizationMarkerAbove(model: Monaco.editor.ITextModel, lineNumber: number) {
    if (lineNumber <= 1) {
      return false;
    }
    return model.getLineContent(lineNumber - 1).trim() === VISUALIZE_MARKER_COMMENT;
  }

  function syncVisualizationMarkers(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monacoApi: typeof Monaco | null,
  ) {
    if (!monacoApi) {
      return;
    }
    if (!enableVisualizationMarkers) {
      markerDecorationIdsRef.current = editor.deltaDecorations(markerDecorationIdsRef.current, []);
      return;
    }
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
    for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
      const line = model.getLineContent(lineNumber);
      if (!isVisualizationCandidateLine(line)) {
        continue;
      }
      const marked = hasVisualizationMarkerAbove(model, lineNumber);
      decorations.push({
        range: new monacoApi.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: marked
            ? "algolens-visualize-marker-active"
            : "algolens-visualize-marker",
          glyphMarginHoverMessage: {
            value: marked
              ? "AlgoLens marker enabled for the next line. Click to remove."
              : "Mark this assignment as a visualization candidate for AI Assist.",
          },
        },
      });
    }

    markerDecorationIdsRef.current = editor.deltaDecorations(markerDecorationIdsRef.current, decorations);
  }

  function toggleVisualizationMarker(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monacoApi: typeof Monaco,
    lineNumber: number,
  ) {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const line = model.getLineContent(lineNumber);
    if (!isVisualizationCandidateLine(line)) {
      return;
    }

    const markerAbove = hasVisualizationMarkerAbove(model, lineNumber);
    const indentation = getLineIndentation(line);
    const markerLine = `${indentation}${VISUALIZE_MARKER_COMMENT}`;

    markerEditInProgressRef.current = true;
    editor.pushUndoStop();
    if (markerAbove) {
      editor.executeEdits("algolens-visualize-toggle", [
        {
          range: new monacoApi.Range(lineNumber - 1, 1, lineNumber, 1),
          text: "",
        },
      ]);
    } else {
      editor.executeEdits("algolens-visualize-toggle", [
        {
          range: new monacoApi.Range(lineNumber, 1, lineNumber, 1),
          text: `${markerLine}\n`,
        },
      ]);
    }
    editor.pushUndoStop();
    syncVisualizationMarkers(editor, monacoApi);
    onCodeChange(editor.getValue());
    window.setTimeout(() => {
      markerEditInProgressRef.current = false;
    }, 0);
  }

  function applyLineHighlight(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monacoApi: typeof Monaco | null,
    line: number | null | undefined,
  ) {
    activeDecorationIdsRef.current = editor.deltaDecorations(activeDecorationIdsRef.current, []);
    if (!monacoApi || !line || line < 1) return;

    activeDecorationIdsRef.current = editor.deltaDecorations([], [
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
    syncVisualizationMarkers(editor, monacoApi);
    editor.onKeyDown((event) => {
      if (markerOnlyMode) {
        const allowedNavigationKeys = new Set([
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          "Escape",
        ]);
        const code = event.browserEvent.code;
        const isCopyShortcut =
          (event.browserEvent.ctrlKey || event.browserEvent.metaKey) &&
          ["KeyC", "KeyA"].includes(code);
        if (!allowedNavigationKeys.has(code) && !isCopyShortcut) {
          event.preventDefault();
          return;
        }
      }

      if (
        event.browserEvent.code === "Space" &&
        !readOnly &&
        !event.browserEvent.altKey &&
        !event.browserEvent.ctrlKey &&
        !event.browserEvent.metaKey
      ) {
        event.browserEvent.preventDefault();
        editor.trigger("keyboard", "type", { text: " " });
      }
    });
    editor.onDidChangeModelContent(() => {
      if (markerOnlyMode && !markerEditInProgressRef.current) {
        editor.setValue(latestCodeRef.current);
        syncVisualizationMarkers(editor, monacoApi);
        return;
      }
      syncVisualizationMarkers(editor, monacoApi);
    });
    editor.onMouseDown((event) => {
      if (!enableVisualizationMarkers) {
        return;
      }
      const gutterTargets = new Set([
        monacoApi.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        monacoApi.editor.MouseTargetType.GUTTER_LINE_DECORATIONS,
        monacoApi.editor.MouseTargetType.GUTTER_LINE_NUMBERS,
      ]);
      if (!gutterTargets.has(event.target.type)) {
        return;
      }
      const lineNumber = event.target.position?.lineNumber;
      if (!lineNumber) {
        return;
      }
      toggleVisualizationMarker(editor, monacoApi, lineNumber);
    });
  }

  useEffect(() => {
    if (!editorRef.current) return;
    applyLineHighlight(editorRef.current, monacoRef.current, activeLine);
  }, [activeLine]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    syncVisualizationMarkers(editorRef.current, monacoRef.current);
  }, [code, enableVisualizationMarkers]);

  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-[#1e1e1e] shadow-sm ${
        fixedHeight || markerOnlyMode ? "" : "h-full flex-1"
      }`}
      style={fixedHeightStyle}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-[#262626] px-4 py-3 text-sm text-[#d1d5db]">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-[#111827] px-2 py-1 text-xs font-medium text-[#9ca3af]">
            {fileLabel}
          </span>
        </div>
        {showResetButton ? (
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
        ) : (
          <div className="text-xs text-[#9ca3af]">
            {enableVisualizationMarkers
              ? "Click the eye icon on assignment lines to mark AI candidates."
              : readOnly
                ? "Read-only"
                : null}
          </div>
        )}
      </div>

      <div
        ref={editorHostRef}
        className={`overflow-hidden ${
          fixedHeight || markerOnlyMode ? "h-full min-h-0" : "h-[640px] flex-1 xl:h-full"
        }`}
      >
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
            glyphMargin: enableVisualizationMarkers,
            folding: false,
            renderLineHighlight: "line",
            tabSize: 4,
            readOnly: markerOnlyMode ? false : readOnly,
            domReadOnly: markerOnlyMode ? true : readOnly,
            }}
        />
      </div>
    </section>
  );
}
