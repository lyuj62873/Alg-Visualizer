# Example: Group Anagrams
# Goal:
# - show nested references by storing VisArray buckets inside a VisMap
# - click the bucket references to inspect each grouped list of strings


class Solution:
    def solve(self, strs):
        groups = VisMap({}, name="groups")

        for word in strs:
            signature = "".join(sorted(word))
            if signature not in groups:
                groups[signature] = VisArray([], name=f"bucket_{signature}")
            groups[signature].append(word)
            watch("current_word", word)
            watch("bucket_count", len(groups))

        return len(groups)


def run_case():
    words = ["eat", "tea", "tan", "ate", "nat", "bat"]
    return Solution().solve(words)
