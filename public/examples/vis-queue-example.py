from collections import deque

from dsviz import VisQueue


class Solution:
    def solve(self):
        queue = VisQueue(deque([10, 11]), name="queue")
        queue.append(12)
        queue.popleft()
        queue.peek()
        return len(queue)


def run_case():
    return Solution().solve()
