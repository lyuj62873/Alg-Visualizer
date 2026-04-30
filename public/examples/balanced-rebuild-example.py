from dsviz import VisArray, VisTreeNode, watch


class Solution:
    def inorder_collect(self, node, values):
        if node is None:
            return
        self.inorder_collect(node.left, values)
        values.append(node.val)
        self.inorder_collect(node.right, values)

    def partition(self, arr, low, high):
        pivot = arr[high]
        watch("pivot", pivot)

        i = low - 1
        watch("i", i)

        for j in range(low, high):
            current = arr[j]
            watch("j", j)
            watch("scan", current)
            if current <= pivot:
                i += 1
                watch("i", i)
                if i != j:
                    left_value = arr[i]
                    arr[i] = current
                    arr[j] = left_value

        pivot_index = i + 1
        if pivot_index != high:
            pivot_value = arr[pivot_index]
            arr[pivot_index] = arr[high]
            arr[high] = pivot_value

        watch("pivot_index", pivot_index)
        return pivot_index

    def quicksort(self, arr, low, high):
        if low >= high:
            return
        watch("quick_lo", low)
        watch("quick_hi", high)
        pivot_index = self.partition(arr, low, high)
        self.quicksort(arr, low, pivot_index - 1)
        self.quicksort(arr, pivot_index + 1, high)

    def clear_tree(self, node):
        if node is None:
            return
        left = node.left
        right = node.right
        node.left = None
        node.right = None
        self.clear_tree(left)
        self.clear_tree(right)

    def build_balanced(self, values, low, high):
        if low > high:
            return None
        mid = (low + high) // 2
        watch("build_mid", mid)
        node = VisTreeNode(values[mid])
        node.left = self.build_balanced(values, low, mid - 1)
        node.right = self.build_balanced(values, mid + 1, high)
        return node

    def solve(self, root):
        # Collect the tree values with an inorder traversal.
        inorder_values = VisArray([])
        self.inorder_collect(root, inorder_values)

        # Sort the array in-place with quicksort so every swap is visible.
        self.quicksort(inorder_values, 0, len(inorder_values) - 1)

        # Disconnect the original tree so the rebuilt tree becomes the active view.
        self.clear_tree(root)

        # Rebuild a balanced tree from the sorted array using divide and conquer.
        rebuilt_root = self.build_balanced(inorder_values, 0, len(inorder_values) - 1)
        watch("rebuilt_root", rebuilt_root.val)
        return rebuilt_root


def run_case():
    # Build a non-BST tree with 10 nodes so inorder collection is not already sorted.
    root = VisTreeNode(7)
    root.left = VisTreeNode(13)
    root.right = VisTreeNode(4)

    root.left.left = VisTreeNode(2)
    root.left.right = VisTreeNode(11)
    root.right.left = VisTreeNode(9)
    root.right.right = VisTreeNode(1)

    root.left.left.left = VisTreeNode(15)
    root.left.left.right = VisTreeNode(6)
    root.right.right.right = VisTreeNode(8)

    solver = Solution()
    return solver.solve(root)
