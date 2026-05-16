# Vis API: delVis(...)
#
# What it removes:
# - an explicit visualization object or node panel entry
#
# What it does not do automatically:
# - detached nodes do not disappear on their own
# - you call delVis(...) when old visual noise is no longer useful


class Solution:
    def solve(self):
        head = VisListNode(1)
        duplicate = VisListNode(1)
        tail = VisListNode(2)
        head.right = duplicate
        duplicate.right = tail

        head.right = tail
        delVis(duplicate)
        watch("head", head.val)
        watch("next_after_cleanup", head.right.val if head.right else None)
        return head.right.val


def run_case():
    return Solution().solve()
