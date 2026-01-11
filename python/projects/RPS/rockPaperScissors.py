'''  Rock Paper Scissors game
     How to play: Type 0 for Rock, 1 for Paper and 2 for Scissors. '''

''' REV : R0
    Date R0: 03/01/2025
    Basic implementation as Course suggests. 
    Use of random implementation, no AI involved, for now'''

### Import libraries
import random 

# FUNCTIONS

def drawAsciiRPS(value):
    '''Function who gets 0 to 2 inputs of the game and converts into strings related to the rock paper scissors game'''
    if (value == 0):  #  chooses rock
        drawAsciiArt('rock')
    if (value == 1): #  chooses paper
        drawAsciiArt('paper')
    if (value == 2): # chooses scissors
        drawAsciiArt('scissors')

def drawAsciiArt(tag):
    '''Draws the ASCII art for the Rock Paper Scissors game. Can be extended to another ASCII arts, to be a part of a library of functions'''
    tag = tag.lower()

    if tag == 'rock':          
        print("""Rock\n
            _______
        ---'   ____)
            (_____)
            (_____)
            (____)
        ---.__(___)
        """)
    
    if tag == 'paper': 
        print("""Paper\n
        _______
    ---'    ____)____
            ______)
            _______)
            _______)
    ---.__________)
    """)
    
    if tag == 'scissors':
        print("""Scissors\n
        _______
        ---'   ____)____
                ______)
            __________)
            (____)
        ---.__(___)
        """)


def decision_RPS (p1_choice,p2_choice):
    '''Just for modularization. Gets the choice of the players and delivers result by printing string
    
    Algorithm used:
    0,0 draw    1,0 win      2,0 lose
    0,1 lose    1,1 draw     2,1 win
    0,2 win     1,2 lose     2,2 draw
'''

    '''Determines the result of Rock-Paper-Scissors for player 1 against player 2.'''
    if p1_choice == p2_choice:
        return "Draw"
    elif (p1_choice + 1) % 3 == p2_choice:
        return "Lose"
    else:
        return "Win"


# Implementation

def main():

    while True:
        iPlayerChoice = int(input("What do you choose? Type 0 for Rock, 1 for Paper and 2 for Scissors:"))
        
        if iPlayerChoice in (0, 1, 2):
            break

    iComputerChoice = random.randint(0, 2)

    print("Player selected: ")
    drawAsciiRPS(iPlayerChoice)

    print("Computer selected")
    drawAsciiRPS(iComputerChoice)

    print(decision_RPS(iPlayerChoice,iComputerChoice))


if __name__ == "__main__":
    main()






