import tkinter as tk
window = tk.Tk()
op = ""
window.title("Calculator")
defaultbg = window.cget('bg')
#window.geometry('')
window.columnconfigure([0, 1, 2, 3,4,5,6,7], minsize= 25)
window.rowconfigure([0, 1, 2, 3,4,5,6,7,8,9,10],minsize = 25)

def sum():
       try:
              op = "summation"
              val1 = float(entry_type1_text.get())
              val2 = float(entry_type2_text.get())
              entry_result_text["text"] = f"{val1 + val2}"
              with open("Calculator_results.txt", "a+") as calc:
                     calc.write("The result of the {operation} between {n1} and {n2} is {result}.\n".format(operation=op, n1=val1, n2=val2,result=val1+val2))
              pass
       except ValueError:
              entry_result_text["text"] = "Error, insert numbers"

def sub():
       try:
              op = "subtraction"
              val1 = float(entry_type1_text.get())
              val2 = float(entry_type2_text.get())
              entry_result_text["text"] = f"{val1 - val2}"
              with open("Calculator_results.txt", "a+") as calc:
                     calc.write("The result of the {operation} between {n1} and {n2} is {result}.\n".format(operation=op, n1=val1, n2=val2,result=val1-val2))

              pass
       except ValueError:
              entry_result_text["text"] = "Error, insert numbers"
              return op

def sor():
       try:
              op = "multiplication"
              val1 = float(entry_type1_text.get())
              val2 = float(entry_type2_text.get())
              entry_result_text["text"] = f"{val1 * val2}"
              with open("Calculator_results.txt", "a+") as calc:
                     calc.write("The result of the {operation} between {n1} and {n2} is {result}.\n".format(operation=op, n1=val1, n2=val2,result=val1*val2))

              pass
       except ValueError:
              entry_result_text["text"] = "Error, insert numbers"
              return op
def div():
       try:
              op = "division"
              val1 = float(entry_type1_text.get())
              val2 = float(entry_type2_text.get())
              entry_result_text["text"] = f"{val1 / val2}"
              with open("Calculator_results.txt", "a+") as calc:
                     calc.write("The result of the {operation} between {n1} and {n2} is {result}.\n".format(operation=op, n1=val1, n2=val2,result=val1/val2))

              pass
       except ValueError:
              entry_result_text["text"] = "Error, insert numbers"

lbl_calculator = tk.Label(text = "Calculator", master=window, font = ("Arial", 20))

entry_type1 = tk.Entry(bg=defaultbg)
entry_type1.insert(0,"Type Value 1:")
entry_type1_text = tk.Entry(bg="white",justify = "center")
entry_type2 = tk.Entry(bg=defaultbg)
entry_type2.insert(0,"Type Value 2:")
entry_type2_text = tk.Entry(bg="white", justify = "center")
btn_sum = tk.Button(master= window, text = "+", command = sum, bg='green')
btn_sub = tk.Button(master= window, text = "-", command = sub, bg='green')
btn_sor = tk.Button(master= window, text = "*", command = sor, bg='green')
btn_div = tk.Button(master= window, text = "/", command = div, bg='green')
entry_result = tk.Entry(bg = defaultbg)
entry_result.insert(0,"Result:")
entry_result_text = tk.Label(text = "", master=window,bg = "white",justify = "center")

lbl_calculator.grid(row = 1, column = 2,columnspan = 4,rowspan = 2, sticky = 'nesw')
entry_type1.grid(row = 5, column = 2,columnspan = 2, sticky = tk.W)
entry_type1_text.grid(row = 5, column = 4,columnspan = 2)
entry_type2.grid(row = 6, column = 2,columnspan = 2)
entry_type2_text.grid(row = 6, column = 4,columnspan = 2)
btn_sum.grid(row = 7, column = 2,sticky = 'nesw')
btn_sub.grid(row = 7, column = 3,sticky = 'nesw')
btn_sor.grid(row = 7, column = 4,sticky = 'nesw')
btn_div.grid(row = 7, column = 5,sticky = 'nesw')
entry_result.grid(row = 9, column = 2, columnspan = 2,sticky = 'nesw' )
entry_result_text.grid(row = 9, column = 4, columnspan = 2,sticky = 'nesw')


window.mainloop()
