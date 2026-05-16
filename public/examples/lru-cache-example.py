# Example: LRU Cache
# Goal:
# - show a custom object panel through VisObject
# - keep the cache state in visualized child structures
# - emphasize that VisObject does not auto-convert ordinary inner containers

from dsviz import VisListNode, VisMap, VisObject, delVis, watch


class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.nodes = VisMap({}, name="nodes")
        self.head = VisListNode("HEAD")
        self.tail = self.head

        # This stays a normal Python dict on purpose.
        # VisObject only shows the fields we explicitly rewrite to VisXxx.
        self._prev = {}

    def _append_to_tail(self, node):
        node.right = None
        self.tail.right = node
        self._prev[node.val[0]] = self.tail
        self.tail = node

    def _detach(self, key):
        prev = self._prev[key]
        node = prev.right
        next_node = node.right

        prev.right = next_node
        if next_node is None:
            self.tail = prev
        else:
            self._prev[next_node.val[0]] = prev

        del self._prev[key]
        node.right = None
        return node

    def _move_to_tail(self, key):
        node = self.nodes[key]
        if node is self.tail:
            return
        moved = self._detach(key)
        self._append_to_tail(moved)

    def get(self, key):
        if key not in self.nodes:
            return -1
        self._move_to_tail(key)
        return self.nodes[key].val[1]

    def put(self, key, value):
        if key in self.nodes:
            node = self.nodes[key]
            node.val = (key, value)
            self._move_to_tail(key)
            return

        if len(self.nodes) == self.capacity:
            lru = self.head.right
            lru_key = lru.val[0]
            self._detach(lru_key)
            del self.nodes[lru_key]
            delVis(lru)
            watch("evicted", lru_key)

        node = VisListNode((key, value))
        self.nodes[key] = node
        self._append_to_tail(node)


class Solution:
    def solve(self):
        # Important:
        # VisObject only wraps the outer custom object. It does not automatically
        # convert ordinary inner containers, so the fields we want to inspect
        # (`nodes`, `head`, and `tail`) are manually rewritten to VisXxx in
        # LRUCache. The helper `_prev` dict stays ordinary Python state.
        cache = LRUCache(2)
        cache_panel = VisObject(cache, name="cache")

        cache.put(1, 10)
        cache.put(2, 20)
        watch("get_1", cache.get(1))
        cache.put(3, 30)
        watch("get_2", cache.get(2))
        watch("get_3", cache.get(3))

        _ = cache_panel
        return len(cache.nodes)


def run_case():
    return Solution().solve()
