# User Guide
#
# 1) What This Site Does
# AlgoLens replays explicit visual objects. It is not an automatic debugger.
# You decide which structures become VisXxx, and only those objects get panels.
#
# 2) Quick Start: Longest Substring Without Repeating Characters
# Paste your LeetCode-style solution here, then rewrite only the parts you want
# to inspect. In this example:
# - `seen` becomes a VisMap so repeated characters are easy to inspect
# - `left` and `best` are tracked with watch(...)
# - everything else stays ordinary Python code
#
# 3) Page Controls and Panels
# - Run Trace: execute the current code and build frames
# - Reset: restore the default Solution / run_case() template
# - Panels: drag, resize, zoom, pan, and click references to jump to children
# - Fit / Track: focus the current panel or follow a referenced one
#
# 4) Where To Go Next
# - Open Examples for full problem-oriented demos
# - Open Vis API for per-class initialization and method usage
#
# 5) Using delVis(...)
# Keep it as an advanced cleanup tool when detached nodes or old panels would
# otherwise stay visible longer than you want.


class Solution:
    def solve(self, s):
        seen = VisMap({}, name="seen")
        left = 0
        best = 0
        watch("left", left)
        watch("best", best)

        for right, ch in enumerate(s):
            if ch in seen and seen[ch] >= left:
                left = seen[ch] + 1
                watch("left", left)

            seen[ch] = right
            best = max(best, right - left + 1)
            watch("best", best)
            watch("window", s[left : right + 1])

        return best


def run_case():
    return Solution().solve("abcaefagh")
