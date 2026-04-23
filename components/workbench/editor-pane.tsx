"use client";

import { Fragment } from "react";

export function EditorPane({
  code,
  inputConfig,
}: {
  code: string;
  inputConfig: string;
}) {
  return (
    <section className="flex min-h-[720px] flex-1 flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-[#1e1e1e] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#262626] px-4 py-3 text-sm text-[#d1d5db]">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-[#111827] px-2 py-1 text-xs font-medium text-[#9ca3af]">
            solution.py
          </span>
          <span>Solution + run_case()</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <span className="rounded-md border border-white/10 px-2 py-1">
            Track variable
          </span>
          <span className="rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-1 text-[#fbbf24]">
            watch(...)
          </span>
        </div>
      </div>

      <div className="grid flex-1 xl:grid-rows-[1fr_220px]">
        <div className="overflow-auto px-0 py-4">
          <div className="grid grid-cols-[52px_1fr] font-mono text-[13px] leading-6">
            {code.split("\n").map((line, index) => (
              <Fragment key={index}>
                <div className="select-none border-r border-white/5 px-4 text-right text-[#6b7280]">
                  {index + 1}
                </div>
                <div
                  className={`whitespace-pre-wrap px-4 ${
                    line.includes('watch("max_val"') || line.includes('watch("i"')
                      ? "bg-[#2d2414] text-[#fbbf24]"
                      : "text-[#e5e7eb]"
                  }`}
                >
                  {line || " "}
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#181818] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Input Config
              </p>
              <p className="mt-1 text-sm text-[#9ca3af]">
                v1 injects <code className="rounded bg-white/5 px-1 py-0.5">inputs</code> into
                `run_case()`
              </p>
            </div>
            <button className="rounded-md border border-white/10 bg-[#232323] px-3 py-2 text-sm text-[#d1d5db]">
              Reset
            </button>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#111827] px-4 py-3 font-mono text-sm text-[#d1d5db]">
            {inputConfig}
          </div>
        </div>
      </div>
    </section>
  );
}
