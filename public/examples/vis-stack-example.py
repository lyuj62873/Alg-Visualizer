from dsviz import VisArray, VisStack


class Solution:
    def solve(self):
        stack = VisStack([1, 2], name="stack")
        nested = VisArray([7, 8], name="nested")
        stack.push(3)
        stack.push(nested)
        stack.pop()
        stack.peek()
        return len(stack)


def run_case():
    return Solution().solve()
