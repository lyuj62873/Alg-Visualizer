from dsviz import VisArray, watch


class Solution:
    def solve(self):
        matrix = VisArray(
            [
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
            ]
        )

        cube = VisArray(
            [
                [[1, 2], [3, 4]],
                [[5, 6], [7, 8]],
            ]
        )

        # 2D list item mutation.
        matrix[1][1] = 55
        watch("matrix_center", matrix[1][1])

        # Keep the matrix rectangular while still showing row-level edits.
        last = matrix[2].pop()
        matrix[2].append(last * 10)

        # 3D list item mutation.
        cube[1][0][1] = 66
        watch("cube_value", cube[1][0][1])

        # Replace a full 2D slice inside the 3D structure.
        cube[0] = [[9, 10], [11, 12]]

        return matrix[2][2] + cube[1][0][1]


def run_case():
    return Solution().solve()
