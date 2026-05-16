# Example: Path Sum III
# Goal:
# - combine VisTreeNode, VisMap, and watch(...)
# - show prefix-sum backtracking while traversing a tree
# - keep the recursive structure close to the original LeetCode solution


class Solution:
    def path_sum_from(self, node, target, prefix_counts, running_sum):
        if node is None:
            return 0

        running_sum += node.val
        watch("running_sum", running_sum)

        matches_here = 1 if running_sum == target else 0
        matches_here += prefix_counts.get(running_sum - target, 0)
        watch("paths_found_here", matches_here)

        prefix_counts[running_sum] = prefix_counts.get(running_sum, 0) + 1

        total = matches_here
        total += self.path_sum_from(node.left, target, prefix_counts, running_sum)
        total += self.path_sum_from(node.right, target, prefix_counts, running_sum)

        prefix_counts[running_sum] -= 1
        if prefix_counts[running_sum] == 0:
            del prefix_counts[running_sum]

        watch("total_paths", total)
        return total

    def solve(self, root, target):
        prefix_counts = VisMap({}, name="prefix_counts")
        return self.path_sum_from(root, target, prefix_counts, 0)


def run_case():
    root = VisTreeNode(10)
    root.left = VisTreeNode(5)
    root.right = VisTreeNode(-3)
    root.left.left = VisTreeNode(3)
    root.left.right = VisTreeNode(2)
    root.right.right = VisTreeNode(11)
    root.left.left.left = VisTreeNode(3)
    root.left.left.right = VisTreeNode(-2)
    root.left.right.right = VisTreeNode(1)

    return Solution().solve(root, 8)
