from dsviz import VisArray, VisMap, delVis


class Solution:
    def solve(self):
        # Child structures keep their own panels.
        odds = VisArray([1, 3], name="odds")
        evens = VisArray([2, 4], name="evens")

        # The map panel shows clickable references to those child panels.
        buckets = VisMap({"odd": odds, "even": evens})

        # Mutating the child arrays updates their own panels.
        odds.append(5)
        evens[1] = 6

        # Add a new referenced child panel during execution.
        primes = VisArray([2, 3, 5], name="primes")
        buckets["prime"] = primes

        # Removing a child visualization should leave a non-clickable summary in the map.
        delVis(primes)

        # Rewire the map contents themselves.
        buckets["even"] = odds
        del buckets["odd"]

        return len(buckets)


def run_case():
    return Solution().solve()
