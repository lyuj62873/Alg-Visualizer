from dsviz import VisListNode, VisTreeNode, watch


class Solution:
    def solve(self):
        # Build two independent tree roots. These should render as two separate
        # tree panels rather than as one aggregated tree canvas.
        root_a = VisTreeNode(5)
        root_a.left = VisTreeNode(3)
        root_a.right = VisTreeNode(8)

        root_b = VisTreeNode(20)
        root_b.left = VisTreeNode(18)
        root_b.right = VisTreeNode(24)

        # Mutate both trees so the trace shows that each panel updates
        # independently over time.
        root_a.left.right = VisTreeNode(4)
        root_b.right.left = VisTreeNode(22)
        watch("tree_a_root", root_a.val)
        watch("tree_b_root", root_b.val)

        # Build two independent linked lists. These should render as two
        # separate list panels rather than a single combined list panel.
        head_a = VisListNode(1)
        head_a.right = VisListNode(2)
        head_a.right.right = VisListNode(3)

        head_b = VisListNode(10)
        head_b.right = VisListNode(11)
        head_b.right.right = VisListNode(12)

        # Rewire each list independently to make the separation obvious.
        inserted_a = VisListNode(99)
        inserted_a.right = head_a.right
        head_a.right = inserted_a

        tail_b = VisListNode(15)
        head_b.right.right.right = tail_b

        watch("list_a_head", head_a.val)
        watch("list_b_head", head_b.val)
        return root_a.val + root_b.val + head_a.val + head_b.val


def run_case():
    return Solution().solve()
