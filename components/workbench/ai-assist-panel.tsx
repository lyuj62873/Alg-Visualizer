"use client";

import { useEffect, useMemo, useState } from "react";

import { EditorPane } from "./editor-pane";

function buildTranslatePrompt(code: string) {
  return `You are translating code for AlgoLens.

Task:
- Translate the following code into clean LeetCode-style Python.
- Preserve the algorithm and data-structure semantics.
- Keep the output as normal Python only.
- Do not add any AlgoLens visualization classes yet.
- Keep the result suitable for pasting into an editor with class-based LeetCode structure.
- Prefer class Solution style when the source problem structure suggests it.
- Do not add extra explanations outside the code block.

Output requirements:
- Return only the translated Python code.
- Do not wrap the answer in markdown fences.

Source code:
\`\`\`
${code}
\`\`\``;
}

function buildRewritePrompt(code: string) {
  return `You are rewriting Python code for AlgoLens, a visualization debugger for LeetCode-style Python.

Goal:
- Rewrite the code so selected data structures use AlgoLens visualization classes.
- Preserve the original algorithm behavior.
- Prefer minimal, low-intrusion changes.

Important constraints:
- Only convert structures that are realistic visualization candidates.
- If a line is clearly unsuitable for visualization, leave it unchanged.
- If comments like "# algolens: visualize" appear, treat them as requests, not commands.
- Preserve correct Python semantics over forcing visualization everywhere.
- Do not add prose outside the final code.
- Return only the rewritten Python code.
- Do not wrap the answer in markdown fences.

AlgoLens conventions you must follow:
- VisArray wraps Python list
- VisStack also uses Python list
- VisQueue must use collections.deque
- VisDeque must use collections.deque
- VisSet must use set
- VisHeap must use Python list with heapq-style operations
- VisMap wraps dict
- VisObject wraps a user-defined class instance
- VisTreeNode and VisListNode are node classes, not container wrappers

Specific rewrite rules:
- Do not rewrite queue-like code into list if it should be deque-based.
- Do not rewrite heap code into a custom heap class; keep list + heapq style.
- For custom helper classes, do not replace the original object variable with VisObject(...) and then keep calling methods on the wrapper.
- Instead, preserve the real object and create a separate VisObject(...) panel variable when appropriate.
- Use watch(...) only for scalar or compact values worth tracking in the Variables panel.
- Use delVis(...) only when explicit visual cleanup is clearly useful.

Small reference examples:
- queue:
  from collections import deque
  q = VisQueue(deque())
- stack:
  st = VisStack([])
- heap:
  pq = VisHeap([])
  pq.heappush(3)
- map:
  mp = VisMap({})
- custom object:
  cache = LRUCache(2)
  cache_view = VisObject(cache)

Code to rewrite:
\`\`\`python
${code}
\`\`\``;
}

type CopyState = "idle" | "copied" | "error";

function PromptSection({
  title,
  description,
  prompt,
}: {
  title: string;
  description: string;
  prompt: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  }

  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-[#d1d5db] bg-[#f9fafb] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-white"
        >
          {copyState === "copied" ? "Copied" : copyState === "error" ? "Retry" : "Copy"}
        </button>
      </div>
      <textarea
        readOnly
        value={prompt}
        className="h-72 w-full resize-none rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] px-3 py-3 font-mono text-xs leading-5 text-[#111827] outline-none"
      />
    </section>
  );
}

export function AIAssistPanel({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const [markedCode, setMarkedCode] = useState(code);

  useEffect(() => {
    setMarkedCode(code);
  }, [code]);

  const translatePrompt = useMemo(() => buildTranslatePrompt(code), [code]);
  const rewritePrompt = useMemo(() => buildRewritePrompt(markedCode), [markedCode]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[#d1d5db] bg-[#f7f7f8] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">AI Assist</h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              Prompt-only helpers for external AI tools. No key storage, no built-in model calls.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <PromptSection
              title="1. Translate to Python"
              description="Use this when your source code is Java, C++, Go, or another language. The result should be plain LeetCode-style Python, not visualized code yet."
              prompt={translatePrompt}
            />
            <PromptSection
              title="2. Rewrite for AlgoLens"
              description="Use this after you already have Python. This prompt tells the AI how to rewrite only sensible structures into AlgoLens-friendly VisXxx code."
              prompt={rewritePrompt}
            />
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">Important</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5563]">
                <li>You are responsible for what you ask the AI to visualize.</li>
                <li>Marking impossible or poor candidates can make the rewrite worse.</li>
                <li>Check the AI result before you paste it back and run it.</li>
                <li>AlgoLens does not call any external AI provider in this flow.</li>
              </ul>
            </section>
            <EditorPane
              code={markedCode}
              onCodeChange={setMarkedCode}
              onResetCode={() => setMarkedCode(code)}
              enableVisualizationMarkers
              readOnly
              showResetButton={false}
              fileLabel="ai_assist.py"
              minHeightPx={520}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
