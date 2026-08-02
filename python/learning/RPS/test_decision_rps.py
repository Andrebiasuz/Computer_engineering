import unittest
from rockPaperScissors import decision_RPS

class test_decision_rps(unittest.TestCase):
    def test_draw_condition(self):
        """Tests that decision_RPS returns 'Draw' when both players make the same choice."""
        self.assertEqual(decision_RPS(0, 0), "Draw")
        self.assertEqual(decision_RPS(1, 1), "Draw")
        self.assertEqual(decision_RPS(2, 2), "Draw")

    def test_win_condition(self):
        """Tests that decision_RPS returns 'Win' when player 1 wins."""
        self.assertEqual(decision_RPS(0, 2), "Win")  # Rock beats Scissors
        self.assertEqual(decision_RPS(1, 0), "Win")  # Paper beats Rock
        self.assertEqual(decision_RPS(2, 1), "Win")  # Scissors beats Paper

    def test_lose_condition(self):
        """Tests that decision_RPS returns 'Lose' when player 1 loses."""
        self.assertEqual(decision_RPS(0, 1), "Lose")  # Rock loses to Paper
        self.assertEqual(decision_RPS(1, 2), "Lose")  # Paper loses to Scissors
        self.assertEqual(decision_RPS(2, 0), "Lose")  # Scissors loses to Rock

if __name__ == "__main__":
    unittest.main()
