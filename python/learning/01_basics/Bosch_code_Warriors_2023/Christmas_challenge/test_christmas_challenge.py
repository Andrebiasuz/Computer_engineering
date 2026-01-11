import unittest
import christmas_challenge

class sortReinderrTestCase(unittest.TestCase):
    

    
    def test_sort(self):

        lst_test = [
  "Dasher Tonoyan", 
  "Dancer Moore", 
  "Prancer Chua", 
  "Vixen Hall", 
  "Comet Karavani",        
  "Cupid Foroutan", 
  "Donder Jonker", 
  "Blitzen Claus"
]
        result = [
  "Prancer Chua",
  "Blitzen Claus",
  "Cupid Foroutan", 
  "Vixen Hall", 
  "Donder Jonker", 
  "Comet Karavani",
  "Dancer Moore", 
  "Dasher Tonoyan",
]
    
        return_test = christmas_challenge.sort_reindeer(lst_test)
        self.assertEqual(return_test, result)

if __name__ == "__main__":
    unittest.main()