from dsviz import VisHeap


class Solution:
    def solve(self):
        heap = VisHeap([5, 1, 3], name="heap")
        heap.heappush(2)
        heap.heapreplace(4)
        heap.peek()
        heap.heappop()
        return len(heap)


def run_case():
    return Solution().solve()
