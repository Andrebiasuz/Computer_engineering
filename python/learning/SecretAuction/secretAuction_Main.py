from art import logo
import secretAuction_functions

print(logo)

database = {}

def main():

    i = 1
    IntroPhase = True

    print("Hello Bidders\n")

    while IntroPhase:
        while True:

            name = str(input(f"Bidder {i}: What is your name: "))
            checkName = str(input(f"The name served was {name}.Correct?(Y/N): "))
            if checkName == "Y":
                break
            
        
        while True:
                
                bid = float(input(f"{name}, Please enter an amount. Ammounts for this bid are in Dollars: "))
                
                try:
                    check_bid = int(input(f"You entered: {bid}. Would you like to confirm the bid? 1 for yes , 0 for no: "))
                    if check_bid == 1:
                        break  
                except ValueError:
                    print("Please try again.")

        database[name] = bid

        name = None
        bid  = None

        secretAuction_functions.clear_screen()
        while True:
            checkForAnotherBidder = int(input("Is there another bidder? Type 1 for Yes and 0 for no. "))

            if checkForAnotherBidder == 0:
                IntroPhase = False

            break

        i = i + 1

  
    max_value_iteration = 0
    name_winner_iteration = ""

    for key, value in database.items():
        if value > max_value_iteration:
            max_value_iteration = value
            name_winner_iteration = key

    winner = [name_winner_iteration, max_value_iteration]

    print(f"Winner is {winner[0]} with {winner[1]} dollars")
    print(database)

if __name__ == "__main__":
    main()
