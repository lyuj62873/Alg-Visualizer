class Solution:
    def solve(self):
        # What it wraps:
        # - Python list
        #
        # Python-native pattern:
        # arr = [1, 2, 3]
        # arr.append(4)
        # arr.sort(key=..., reverse=...)
        #
        # Visualized pattern:
        # arr = VisArray([1, 2, 3])

        arr = VisArray([1, 2, 3])
        arr.append(4)
        arr.insert(1, 99)
        x = arr[2]
        arr[0] = 42
        del arr[3]
        last = arr.pop()
        front = arr.pop(0)
        arr.remove(99)
        arr.extend([7, 8])
        arr.sort(key=lambda value: -value)
        arr.reverse()
        arr.clear()
        delVis(arr)

        return x + last + front


def run_case():
    return Solution().solve()
