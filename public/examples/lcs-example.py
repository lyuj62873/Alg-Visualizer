# Example: Longest Common Subsequence
# Goal:
# - show a 2D VisArray used as a dynamic-programming table
# - watch the current answer and the active cell coordinates
# - keep the code close to a normal LeetCode tabulation solution


class Solution:
    def solve(self, text1, text2):
        rows = len(text1) + 1
        cols = len(text2) + 1
        dp = VisArray([[0] * cols for _ in range(rows)])

        for i in range(1, rows):
            for j in range(1, cols):
                watch("cell", (i, j))
                watch("text1Char", text1[i - 1])
                watch("text2Char", text2[j - 1])
                if text1[i - 1] == text2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                watch("lcs_so_far", dp[i][j])

        return dp[-1][-1]


def run_case():
    return Solution().solve("abcde", "ace")
