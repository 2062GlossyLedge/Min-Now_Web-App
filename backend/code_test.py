import unittest


def add(a, b):
    return a + b


def subtract(a, b):
    return a - b


class TestMathFunctions(unittest.TestCase):
    def test_add_positive_numbers(self):
        self.assertEqual(add(2, 3), 5)

    def test_add_negative_numbers(self):
        self.assertEqual(add(-1, -1), -2)

    def test_add_zero(self):
        self.assertEqual(add(0, 5), 5)

    def test_subtract_positive_numbers(self):
        self.assertEqual(subtract(5, 3), 2)

    def test_subtract_negative_numbers(self):
        self.assertEqual(subtract(-2, -3), 1)

    def test_subtract_zero(self):
        self.assertEqual(subtract(0, 5), -5)


if __name__ == "__main__":
    unittest.main()
