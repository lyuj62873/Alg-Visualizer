from dsviz import VisListNode


class Solution:
    def solve(self):
        # Singly linked list init: head -> 2 -> 5 -> 8
        head = VisListNode(2)
        head.right = VisListNode(5)
        head.right.right = VisListNode(8)

        # Insert a node after the head.
        inserted = VisListNode(3)
        inserted.right = head.right
        head.right = inserted

        # Update a node value in place.
        inserted.right.val = 6

        # Append a tail node.
        tail = VisListNode(11)
        inserted.right.right = tail

        # Detach the old tail and replace it.
        inserted.right.right = VisListNode(9)

        return head.right.right.val


def run_case():
    return Solution().solve()
