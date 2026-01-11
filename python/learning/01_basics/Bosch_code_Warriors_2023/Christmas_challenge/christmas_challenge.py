'''Task
Write a function that accepts a sequence of Reindeer names, and returns a sequence with the Reindeer names sorted by their last names.

Rules
- it's guaranteed that each string is composed of two words
- in case of two identical last names, keep the original order

Example
For this input:
[
  "Dasher Tonoyan", 
  "Dancer Moore", 
  "Prancer Chua", 
  "Vixen Hall", 
  "Comet Karavani",        
  "Cupid Foroutan", 
  "Donder Jonker", 
  "Blitzen Claus"
]'''


def sort_reindeer(reindeer_names):
    reindeer_names_sorted = sorted(reindeer_names, key = lambda reindeer_names: reindeer_names.split(" ")[1][0])
    return reindeer_names_sorted

