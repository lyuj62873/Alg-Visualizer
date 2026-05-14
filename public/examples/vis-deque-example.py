from dsviz import VisDeque


class Solution:
    def solve(self):
        dq = VisDeque([2, 3], name="dq")
        dq.append_left(1)
        dq.append_right(4)
        dq.pop_left()
        dq.pop_right()
        return len(dq)


def run_case():
    return Solution().solve()
