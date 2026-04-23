from dsviz import VisTreeNode


class Solution:
    def solve(self):
        # Python object init: root = TreeNode(5)
        # VisTreeNode init: root = VisTreeNode(5)
        root = VisTreeNode(5)

        # Python object set: root.left = TreeNode(3)
        root.left = VisTreeNode(3)

        # Python object set: root.right = TreeNode(8)
        root.right = VisTreeNode(8)

        # Python object set: root.left.right = TreeNode(4)
        root.left.right = VisTreeNode(4)

        # Python object get: left_val = root.left.val
        left_val = root.left.val

        # Python object set: root.val = 10
        root.val = 10

        # Python object detach: root.right = None
        root.right = None

        return left_val


def run_case():
    return Solution().solve()
