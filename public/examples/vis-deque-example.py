from collections import deque

from dsviz import VisDeque


class Solution:
    def solve(self):
        dq = VisDeque(deque([2, 3]), name="dq")
        dq.appendleft(1)
        dq.append(4)
        dq.popleft()
        dq.pop()
        return len(dq)


def run_case():
    return Solution().solve()
