from dsviz import VisListNode, delVis, watch


class Solution:
    def delete_duplicates(self, head):
        cur = head
        watch("cur", cur.val if cur else None)

        while cur is not None and cur.right is not None:
            next_node = cur.right
            watch("next", next_node.val if next_node else None)

            if cur.val == next_node.val:
                # Rewire first, then explicitly remove the detached node from the
                # visualization. Detached objects otherwise stay visible until
                # the user calls delVis(...) on them.
                cur.right = next_node.right
                delVis(next_node)
                watch("removed", next_node.val)
            else:
                cur = next_node
                watch("cur", cur.val if cur else None)

        return head


def run_case():
    # Sorted list: 1 -> 1 -> 2 -> 3 -> 3 -> 4 -> 4 -> 5
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

    values = []
    cursor = deduped_head
    while cursor is not None:
        values.append(cursor.val)
        cursor = cursor.right

    watch("result", values)
    return values
