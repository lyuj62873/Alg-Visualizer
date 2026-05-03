from dsviz import VisArray, delVis


class Solution:
    def solve(self):
        # Python list init: arr = [1, 2, 3]
        # VisArray init: arr = VisArray([1, 2, 3])
        arr = VisArray([1, 2, 3])

        # Python list append: arr.append(4)
        arr.append(4)

        # Python list insert: arr.insert(1, 99)
        arr.insert(1, 99)

        # Python list get: x = arr[2]
        x = arr[2]

        # Python list set: arr[0] = 42
        arr[0] = 42

        # Python list delete: del arr[3]
        del arr[3]

        # Python list pop: last = arr.pop()
        last = arr.pop()

        # Python list pop(index): front = arr.pop(0)
        front = arr.pop(0)

        # Python list remove: arr.remove(99)
        arr.remove(99)

        # Python list extend: arr.extend([7, 8])
        arr.extend([7, 8])

        # Python list reverse: arr.reverse()
        arr.reverse()

        # Python list clear: arr.clear()
        arr.clear()

        # Remove the array visualization panel.
        delVis(arr)

        return x + last + front


def run_case():
    return Solution().solve()
