from dsviz import VisListNode, watch


class Solution:
    def reverse_list(self, head):
        prev = None
        curr = head
        watch("prev", prev)
        watch("curr", curr.val if curr else None)

        while curr is not None:
            nxt = curr.right
            watch("nxt", nxt.val if nxt else None)

            curr.right = prev
            prev = curr
            curr = nxt

            watch("prev", prev.val if prev else None)
            watch("curr", curr.val if curr else None)

        return prev


def run_case():
    head = VisListNode(1)
    head.right = VisListNode(2)
    head.right.right = VisListNode(3)
    head.right.right.right = VisListNode(4)
    head.right.right.right.right = VisListNode(5)

    solver = Solution()
    reversed_head = solver.reverse_list(head)
    watch("reversed_head", reversed_head.val if reversed_head else None)
    return reversed_head.val if reversed_head else None
