from dsviz import (
    VisArray,
    VisDeque,
    VisHeap,
    VisListNode,
    VisMap,
    VisQueue,
    VisSet,
    VisStack,
    VisTreeNode,
    watch,
)


class Solution:
    def solve(self):
        # 1) Every visual family appears both as a parent panel and as a child reference.
        mirror_array = VisArray([], name="mirror_array")
        mirror_map = VisMap({}, name="mirror_map")
        mirror_array.append(mirror_map)
        mirror_map["array"] = mirror_array

        mirror_stack = VisStack([], name="mirror_stack")
        mirror_head = VisListNode(mirror_stack)
        mirror_head.right = VisListNode("tail")
        mirror_stack.push(mirror_head)

        mirror_queue = VisQueue([], name="mirror_queue")
        mirror_root = VisTreeNode(mirror_queue)
        mirror_root.left = VisTreeNode("leaf")
        mirror_queue.enqueue(mirror_root)

        mirror_set = VisSet([], name="mirror_set")
        mirror_deque = VisDeque([mirror_set], name="mirror_deque")
        mirror_set.add(mirror_deque)

        heap_child_tree = VisTreeNode(7)
        mirror_heap = VisHeap([heap_child_tree], name="mirror_heap")
        tree_child_heap = VisHeap([3], name="tree_child_heap")
        mirror_tree = VisTreeNode(tree_child_heap)
        mirror_tree.left = VisTreeNode("leaf")

        # 2) A cycle: Map -> List -> Map, with the list looping back to the outer map.
        cycle_outer = VisMap({"kind": "outer"}, name="cycle_outer")
        cycle_head = VisListNode("placeholder")
        cycle_inner = VisMap({"outer": cycle_outer}, name="cycle_inner")
        cycle_head.val = cycle_inner
        cycle_head.right = VisListNode(cycle_outer)
        cycle_outer["head"] = cycle_head

        # 3) A deeper chain: Map -> List -> Set, then continue one step further.
        chain_heap = VisHeap([6], name="chain_heap")
        chain_set = VisSet([chain_heap], name="chain_set")
        chain_head = VisListNode(chain_set)
        chain_head.right = VisListNode(VisArray(["leaf"], name="chain_array"))
        chain_map = VisMap({"chain": chain_head}, name="chain_map")

        # Touch a few references so the trace shows both panel-level and nested activity.
        mirror_array[0]
        mirror_map["array"]
        mirror_stack.peek()
        mirror_queue.peek()
        mirror_deque.append_right(chain_map)
        mirror_set.add(chain_head)
        mirror_heap.peek()
        watch("cycle_has_head", "head" in cycle_outer)
        watch("chain_size", len(chain_set))

        return (
            len(mirror_array)
            + len(mirror_map)
            + len(mirror_stack)
            + len(mirror_queue)
            + len(mirror_deque)
            + len(mirror_set)
            + len(mirror_heap)
            + len(chain_map)
        )


def run_case():
    return Solution().solve()
