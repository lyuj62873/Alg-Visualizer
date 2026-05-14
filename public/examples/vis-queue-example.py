from dsviz import VisQueue


class Solution:
    def solve(self):
        queue = VisQueue([10, 11], name="queue")
        queue.enqueue(12)
        queue.dequeue()
        queue.peek()
        return len(queue)


def run_case():
    return Solution().solve()
