from dsviz import VisSet


class Solution:
    def solve(self):
        seen = VisSet({3, 1}, name="seen")
        seen.add(4)
        seen.add(1)
        seen.discard(3)
        return 1 if 4 in seen else 0


def run_case():
    return Solution().solve()
