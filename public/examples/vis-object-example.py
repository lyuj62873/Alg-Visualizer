from dsviz import VisObject, VisStack, watch


class MyQueue:
    def __init__(self):
        self.in_stack = VisStack([], name="in_stack")
        self.out_stack = VisStack([], name="out_stack")
        self.size = 0

    def push(self, value: int) -> None:
        self.in_stack.push(value)
        self.size += 1

    def _shift(self) -> None:
        if len(self.out_stack) != 0:
            return
        while len(self.in_stack) != 0:
            self.out_stack.push(self.in_stack.pop())

    def peek(self) -> int:
        self._shift()
        return self.out_stack.peek()

    def pop(self) -> int:
        self._shift()
        self.size -= 1
        return self.out_stack.pop()

    def empty(self) -> bool:
        return self.size == 0


class Solution:
    def solve(self):
        queue = MyQueue()
        queue_panel = VisObject(queue)

        queue.push(10)
        queue.push(20)
        watch("peek_before_pop", queue.peek())
        front = queue.pop()
        watch("front", front)
        watch("empty", queue.empty())

        # Keep the wrapper live while the child stacks mutate.
        _ = queue_panel
        return queue.size


def run_case():
    return Solution().solve()
