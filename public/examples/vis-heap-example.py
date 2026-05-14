from dsviz import VisHeap


class Solution:
    def solve(self):
        heap = VisHeap([5, 1, 3], name="heap")
        heap.push(2)
        heap.replace(4)
        heap.peek()
        heap.pop()
        return len(heap)


def run_case():
    return Solution().solve()
