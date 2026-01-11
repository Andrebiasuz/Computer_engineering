def is_leap_year(year):
    if (year >= 1600 and year <= 4000):
        if not (year % 4):
            if not (year % 100):
                if not (year % 400):
                    return True
                else:
                    return False
            else:
                return True
        else:
            return False
    else:
        return None


print(is_leap_year(2000))
print(is_leap_year(2100))
print(is_leap_year(5000))
