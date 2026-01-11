"""Perform a restaurant tip calculator, the final result should return 2 decimal points """


print("Welcome to the Tip Calculator")
total_value = float(input("What was the total bill? "))
percentage = float(input("What percentage tip would you like to give? "))
people_to_split = int(input("How many people to split the bill? "))


each_person_value_with_tip = total_value * (1 + percentage / 100) / people_to_split

print(f"Each person should pay {round(each_person_value_with_tip, 2)}.")
