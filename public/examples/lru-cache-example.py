# Example: LRU Cache
# Goal:
# - show a custom object panel through VisObject
# - keep the cache state in visualized child structures
# - stay close to the standard doubly linked list + hash map solution

from dsviz import VisListNode, VisMap, VisObject, delVis, watch


class DLinkedNode(VisListNode):
    def __init__(self, key=0, value=0):
        super().__init__((key, value))
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

    @property
    def next(self):
        return self.right

    @next.setter
    def next(self, node):
        self.right = node

    def set_value(self, value):
        self.value = value
        self.val = (self.key, value)


class LRUCache:
    def __init__(self, capacity: int):
        self.cache = VisMap({}, name="cache")
        # Use pseudo head and pseudo tail nodes.
        self.head = DLinkedNode()
        self.tail = DLinkedNode()
        self.head.next = self.tail
        self.tail.prev = self.head
        self.capacity = capacity
        self.size = 0

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        # If the key exists, move the node to the head first.
        node = self.cache[key]
        self.moveToHead(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        if key not in self.cache:
            # If the key does not exist, create a new node.
            node = DLinkedNode(key, value)
            # Insert it into the hash map.
            self.cache[key] = node
            # Insert it at the head of the doubly linked list.
            self.addToHead(node)
            self.size += 1
            if self.size > self.capacity:
                # Remove the tail node if the capacity is exceeded.
                removed = self.removeTail()
                # Remove the corresponding entry from the hash map.
                self.cache.pop(removed.key)
                delVis(removed)
                self.size -= 1
                watch("evicted", removed.key)
        else:
            # If the key exists, update the value and move it to the head.
            node = self.cache[key]
            node.set_value(value)
            self.moveToHead(node)

    def addToHead(self, node):
        node.prev = self.head
        node.next = self.head.next
        self.head.next.prev = node
        self.head.next = node

    def removeNode(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def moveToHead(self, node):
        self.removeNode(node)
        self.addToHead(node)

    def removeTail(self):
        node = self.tail.prev
        self.removeNode(node)
        return node


class Solution:
    def solve(self):
        # Important:
        # VisObject only wraps the outer custom object. The internal structures
        # that should become child panels still need to be rewritten manually.
        cache = LRUCache(2)
        cache_panel = VisObject(cache, name="cache_view")

        cache.put(1, 10)
        cache.put(2, 20)
        watch("get_1", cache.get(1))
        cache.put(3, 30)
        watch("get_2", cache.get(2))
        watch("get_3", cache.get(3))

        _ = cache_panel
        return cache.size


def run_case():
    return Solution().solve()
