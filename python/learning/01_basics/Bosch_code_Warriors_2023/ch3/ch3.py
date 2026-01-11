def add_length(str_):
    x = str_.split(" ")
    appended_list = []
    for idx1 , value in enumerate(x):
        appended_list.append(f"{x[idx1]} {len(x[idx1])}")
    return appended_list

print(add_length("Amore Linda demais"))


