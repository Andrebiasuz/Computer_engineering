def even_or_odd(number):
    if not number % 2 :
        return "Even"
    return "Odd"

import datetime
start_time = datetime.datetime.now()
for i in range(0,1000000):
    a = (even_or_odd(2))
end_time = datetime.datetime.now()
print(end_time - start_time)