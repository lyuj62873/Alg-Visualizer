from dsviz import VisArray, VisTreeNode, watch


class Solution:
    def inorder_collect(self, node, values):
        if node is None:
            return
        self.inorder_collect(node.left, values)
        values.append(node.val)
        self.inorder_collect(node.right, values)

    def build_balanced_children(self, values, low, high):
        if low > high:
            return None
        mid = (low + high) // 2
        watch("build_mid", mid)
        child = VisTreeNode(values[mid])
        child.left = self.build_balanced_children(values, low, mid - 1)
        child.right = self.build_balanced_children(values, mid + 1, high)
        return child

    def build_balanced_root(self, values):
        if len(values) == 0:
            return None

        mid = len(values) // 2
        watch("balanced_root_index", mid)
        balanced_root = VisTreeNode(values[mid])
        balanced_root.left = self.build_balanced_children(values, 0, mid - 1)
        balanced_root.right = self.build_balanced_children(values, mid + 1, len(values) - 1)
        return balanced_root

    def solve(self, unbalanced_root):
        # Inorder traversal of a BST already yields sorted values, so the array
        # can be used directly to build a second balanced BST.
        inorder_values = VisArray([])
        self.inorder_collect(unbalanced_root, inorder_values)
        watch("inorder_count", len(inorder_values))

        balanced_root = self.build_balanced_root(inorder_values)
        watch("source_root", unbalanced_root.val if unbalanced_root else None)
        watch("balanced_root", balanced_root.val if balanced_root else None)
        return balanced_root


def run_case():
    # Build a deliberately unbalanced BST as a right-heavy chain.
    unbalanced_root = VisTreeNode(2)
    unbalanced_root.right = VisTreeNode(4)
    unbalanced_root.right.right = VisTreeNode(6)
    unbalanced_root.right.right.right = VisTreeNode(8)
    unbalanced_root.right.right.right.right = VisTreeNode(10)
    unbalanced_root.right.right.right.right.right = VisTreeNode(12)
    unbalanced_root.right.right.right.right.right.right = VisTreeNode(14)
    unbalanced_root.right.right.right.right.right.right.right = VisTreeNode(16)
    unbalanced_root.right.right.right.right.right.right.right.right = VisTreeNode(18)

    solver = Solution()
    return solver.solve(unbalanced_root)
