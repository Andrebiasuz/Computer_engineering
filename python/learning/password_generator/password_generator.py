"""
Generate a N character alphanumeric password with N lower case characters , 
N uppercase characters, and N digits or special characters:

Adapted from standard documentation. 

27/09/2023 - CREATED - REV0
"""

import string
import secrets

while True:
    password_lenght = int(input("How many characters the password should have? "))

    if password_lenght == 0:
        continue

    password_lower_case = int(
        input("How many lower characters the password should have? ")
    )
    print(f"You have {password_lenght - password_lower_case} characters left to sort.")
    password_upper_case = int(
        input("How many upper characters the password should have? ")
    )
    print(
        f"You have {password_lenght - password_lower_case - password_upper_case} characters left to sort."
    )
    password_digits_or_special = int(
        input("How many digits or special characters the password should have? ")
    )

    if not (
        password_lower_case + password_upper_case + password_digits_or_special
        == password_lenght
    ):
        print("Values dont match, please repeat the process.\n")
        password_lenght = 0
        password_lower_case = 0
        password_upper_case = 0
        password_digits_or_special = 0
    else:
        break

alphabet = string.ascii_letters + string.digits + string.punctuation
while True:
    password = "".join(secrets.choice(alphabet) for i in range(password_lenght))
    if (
        sum(c.islower() for c in password) >= password_lower_case
        and sum(c.isupper() for c in password) >= password_upper_case
        and sum(c.isdigit() for c in password) >= password_digits_or_special
    ):
        break

print(password)
