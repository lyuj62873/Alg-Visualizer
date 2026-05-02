from dsviz import VisListNode, watch


class Solution:
    def delete_duplicates(self, head):
        cur = head
        pre = None
        watch("pre", pre)
        watch("cur", cur.val if cur else None)

        while cur is not None:
            next_node = cur.right
            watch("next", next_node.val if next_node else None)

            if pre is not None and cur.val == pre.val:
                pre.right = next_node
            else:
                pre = cur

            cur = next_node

            watch("pre", pre.val if pre else None)
            watch("cur", cur.val if cur else None)

        return head


def run_case():
    head = VisListNode(1)
    head.right = VisListNode(1)
    head.right.right = VisListNode(2)
    head.right.right.right = VisListNode(3)
    head.right.right.right.right = VisListNode(3)
    head.right.right.right.right.right = VisListNode(4)
    head.right.right.right.right.right.right = VisListNode(4)
    head.right.right.right.right.right.right.right = VisListNode(5)

    solver = Solution()
    deduped_head = solver.delete_duplicates(head)
    watch("deduped_head", deduped_head.val if deduped_head else None)
    return deduped_head.val if deduped_head else None
