def prime_checker(number):
    """function to check if a number is prime. Entries between 0 and 100. Returns a Boolean"""
    # hard-coded math exceptions
    if number == 0 or number == 1:
        print("It's not a prime number.")
        return False

    for i in range(2, 101):
        if i > n:
            return True

        if n != i:
            if n % i == 0:
                return False


n = int(input())  # Check this number
prime_checker(number=n)
