import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "public" / "py"))

from dsviz import (  # noqa: E402
    _preferred_array_panel_height,
    _preferred_nested_panel_height,
)


class ArrayPanelSizingTests(unittest.TestCase):
    def test_two_dimensional_preview_height_is_capped(self):
        height = _preferred_array_panel_height(
            layout="matrix",
            dimensions=(10, 4),
            height_units=18.0,
            min_height=18.0,
            max_height=44.0,
        )

        self.assertAlmostEqual(height, 35.12)
        self.assertLessEqual(height, 44.0)

    def test_three_dimensional_preview_height_stays_within_stack_cap(self):
        height = _preferred_array_panel_height(
            layout="stack",
            dimensions=(5, 6, 3),
            height_units=42.0,
            min_height=20.0,
            max_height=52.0,
        )

        self.assertLessEqual(height, 52.0)
        self.assertGreater(height, 40.0)

    def test_higher_dimensional_preview_uses_same_slice_limit(self):
        three_dim = _preferred_nested_panel_height((3, 6, 3))
        nested_four_dim = _preferred_nested_panel_height((8, 3, 6, 3))
        capped_four_dim = _preferred_array_panel_height(
            layout="stack",
            dimensions=(8, 3, 6, 3),
            height_units=80.0,
            min_height=20.0,
            max_height=52.0,
        )

        self.assertGreater(nested_four_dim, three_dim)
        self.assertGreater(nested_four_dim, 52.0)
        self.assertAlmostEqual(capped_four_dim, 52.0)


if __name__ == "__main__":
    unittest.main()
