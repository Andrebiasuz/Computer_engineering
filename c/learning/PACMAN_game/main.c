#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>
#include <stdlib.h>
#include <time.h>
#include "functions.h"

int main() {

    char previous_guess[26];
    int mistake = 0;
    int counter = 0;
    char hidden_word[20];
    char game_word[strlen(hidden_word) + 1];
    char enter;
    bool got_it = false;
    bool hanged = false;
    int attempts = 5;
    int letters_right = 0;

    getWordFile(hidden_word);
    fillGameWord(hidden_word, game_word);
    title();

    while (!hanged && !got_it) {

        bool mistake_finder = true;
        printf("Game word is %s \n \n", game_word);

        char guess = enterGuess();
        bool already_guess_finder = alreadyGuessed(previous_guess, guess);

        if (!already_guess_finder) {

            goodGuess(hidden_word, game_word, guess, & mistake_finder, & letters_right);
            countMistakes(&mistake, &mistake_finder, &attempts);
            printGuessList(previous_guess, guess, & counter);
        }

        got_it = wonGame(&letters_right , hidden_word);
        hanged = gotHanged(&mistake , &attempts);
    }

    (got_it) ? writeWordFile(): 1;
    return 0;
}
