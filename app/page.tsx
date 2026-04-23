const codeSample = `from dsviz import VisArray, VisBST, watch

class Solution:
    def solve(self, nums):
        max_val = 0
        watch("max_val", max_val)

        bst = VisBST("working tree")
        for i, value in enumerate(nums):
            watch("i", i)
            bst.insert(value)
            if value > max_val:
                max_val = value
                watch("max_val", max_val)

        return max_val

def run_case():
    nums = VisArray(inputs["nums"], name="nums")
    sol = Solution()
    return sol.solve(nums)`;

const variables = [
  { name: "i", value: "2" },
  { name: "max_val", value: "8" },
  { name: "current", value: "8" },
];

const arrayValues = ["5", "3", "8", "4"];

const bstNodes = [
  { id: "5", label: "5", className: "top-[12%] left-[42%]" },
  { id: "3", label: "3", className: "top-[38%] left-[20%]" },
  { id: "8", label: "8", className: "top-[38%] right-[18%]" },
  { id: "4", label: "4", className: "bottom-[10%] left-[34%]" },
];

const bstEdges = [
  "absolute left-[32%] top-[28%] h-24 w-px rotate-[58deg] bg-stone-500/60",
  "absolute right-[31%] top-[28%] h-24 w-px -rotate-[58deg] bg-stone-500/60",
  "absolute left-[29%] top-[56%] h-20 w-px -rotate-[42deg] bg-stone-500/60",
];

export default function Home() {
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
                {codeSample.split("\n").map((line, index) => (
                  <Fragment key={index}>
                    <div
                      className="select-none border-r border-white/5 px-4 text-right text-[#6b7280]"
                    >
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
                {`inputs = {\n  "nums": [5, 3, 8, 4]\n}`}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[720px] w-full flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-white shadow-sm xl:w-[48%] xl:min-w-[540px]">
          <div className="border-b border-[#e5e7eb] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {["Visualization", "Variables", "Output"].map((tab, index) => (
                  <button
                    key={tab}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      index === 0
                        ? "bg-[#fff7ed] text-[#c2410c]"
                        : "text-[#6b7280] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {["Prev", "Next"].map((label) => (
                  <button
                    key={label}
                    className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151]"
                  >
                    {label}
                  </button>
                ))}
                <div className="rounded-md bg-[#f3f4f6] px-3 py-2 text-sm text-[#4b5563]">
                  Frame 3 / 7
                </div>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-4 overflow-auto bg-[#fafafa] p-4 xl:grid-cols-[1.55fr_0.95fr]">
            <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
              <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3 text-sm">
                <span className="font-medium text-[#111827]">BST Panel</span>
                <span className="text-[#6b7280]">insert(4)</span>
              </div>
              <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)] p-6">
                {bstEdges.map((className) => (
                  <div key={className} className={className} />
                ))}

                {bstNodes.map((node) => (
                  <div
                    key={node.id}
                    className={`absolute flex h-14 w-14 items-center justify-center rounded-full border border-[#d1d5db] bg-white text-lg font-semibold text-[#111827] shadow-sm ${node.className}`}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border border-[#e5e7eb] bg-white">
                <div className="border-b border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
                  Array / Input
                </div>
                <div className="grid grid-cols-4 gap-2 p-4">
                  {arrayValues.map((value, index) => (
                    <div
                      key={`${value}-${index}`}
                      className={`rounded-lg border px-3 py-3 text-center text-sm font-medium ${
                        index === 2
                          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
                          : "border-[#e5e7eb] bg-[#f9fafb] text-[#374151]"
                      }`}
                    >
                      {value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white">
                <div className="border-b border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
                  Variables
                </div>
                <div className="space-y-2 p-4">
                  {variables.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 text-sm"
                    >
                      <span className="font-medium text-[#374151]">{item.name}</span>
                      <span className="font-mono text-[#111827]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white">
                <div className="border-b border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
                  Output
                </div>
                <div className="space-y-3 p-4 text-sm text-[#4b5563]">
                  <div className="rounded-lg border border-[#d1fae5] bg-[#ecfdf5] px-3 py-3 text-[#065f46]">
                    Trace loaded successfully. `run_case()` returned `8`.
                  </div>
                  <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 font-mono text-xs text-[#374151]">
                    stdout: 4 frames emitted by dsviz
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
import { Fragment } from "react";
