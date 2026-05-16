# Example: LRU Cache
# Goal:
# - show a custom object panel through VisObject
# - keep the cache state in visualized child structures
# - emphasize that VisObject does not auto-convert ordinary inner containers


class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.values = VisMap({}, name="values")
        self.order = VisArray([], name="order")

    def _touch(self, key):
        if key in self.order:
            self.order.remove(key)
        self.order.append(key)

    def get(self, key):
        if key not in self.values:
            return -1
        self._touch(key)
        return self.values[key]

    def put(self, key, value):
        if key in self.values:
            self.values[key] = value
            self._touch(key)
            return

        if len(self.order) == self.capacity:
            evicted = self.order.pop(0)
            del self.values[evicted]
            watch("evicted", evicted)

        self.values[key] = value
        self.order.append(key)


class Solution:
    def solve(self):
        # Important:
        # VisObject only wraps the outer custom object. It does not automatically
        # convert ordinary inner containers, so the fields we want to inspect
        # (`values` and `order`) are manually rewritten to VisXxx in LRUCache.
        cache = LRUCache(2)
        cache_panel = VisObject(cache, name="cache")

        cache.put(1, 10)
        cache.put(2, 20)
        watch("get_1", cache.get(1))
        cache.put(3, 30)
        watch("get_2", cache.get(2))
        watch("get_3", cache.get(3))

        _ = cache_panel
        return len(cache.values)


def run_case():
    return Solution().solve()
