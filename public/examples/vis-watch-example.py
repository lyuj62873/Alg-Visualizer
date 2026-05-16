# Vis API: watch(...)
#
# What it tracks:
# - explicit scalar snapshots that should appear in the Variables panel
#
# Use watch(...) when:
# - a value is important but not worth turning into a VisXxx panel
# - you want to show the current answer, pointer positions, or small summaries


class Solution:
    def solve(self):
        nums = VisArray([2, 7, 11, 15], name="nums")
        best = 0
        watch("best", best)

        for idx, value in enumerate(nums):
            best = max(best, value)
            watch("idx", idx)
            watch("best", best)

        return best


def run_case():
    return Solution().solve()
