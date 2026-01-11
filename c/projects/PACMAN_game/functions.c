#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>
#include <stdlib.h>
#include <time.h>

void title() {
    printf("******************************\n");
    printf(" Welcome to the Hangman game   \n");
    printf("******************************\n\n");
}


void getWordFile(char* hiddenWordFile) {

    FILE* f;
    int numWords;

    f = fopen("palavras.txt", "r");
    if (f == 0) {
        printf("Error while opening file \n");
        exit(1);
    }
    else {

        fscanf(f, "%d", &numWords );
        srand(time(0));
        int randomNum = rand() % numWords;

        for(int i=0; i<= randomNum ; i++){
            fscanf(f, "%s", hiddenWordFile);
        }

    fclose(f);
    }
}

void fillGameWord(char* hidden, char* guessingWord) {
    guessingWord[strlen(hidden)] = '\0';
    for (int i = 0; i < strlen(hidden); i++) { // fill gameword with spaces
        guessingWord[i] = '_';
    }
}

char enterGuess() {
    char guessTR;
    printf("\nPlease enter your guess: ");
    scanf(" %c", & guessTR);
    return guessTR;
}

bool alreadyGuessed(char * previousGuessArray, char * guessTR) {
    bool guessedBefore = false;
    for (int idx = 0; idx < strlen(previousGuessArray); idx++) {
        if (previousGuessArray[idx] == guessTR) {
            printf("You have already guessed this! \n");
            guessedBefore = true;
        }
    }
    return guessedBefore;
}

void goodGuess(char * hidden, char * guessingWord, char * guessTR, bool * mistake_bool, int * correct_letters) {
    for (int i = 0; i < strlen(hidden); i++) {
        if (hidden[i] == guessTR) {
            guessingWord[i] = guessTR;
            * correct_letters = * correct_letters + 1;
            * mistake_bool = false;
        }

    }
}

void printGuessList(char * previousGuessArray, char * guessTR, int * guesscounter) {
    previousGuessArray[ * guesscounter] = guessTR;
    printf("You have guessed the following words: ");
    for (int j = 0; j <= * guesscounter; j++) {
        printf("%c , ", previousGuessArray[j]);
    }
    printf("\n");
    *guesscounter = *guesscounter + 1;
    //printf("Number of guesses: %d \n", * guesscounter);
}

void countMistakes(int* currentNumberMistakes, bool* bolleanMistakeFlag, int* thresold ) {
      (*bolleanMistakeFlag == 1) ? (*currentNumberMistakes = *currentNumberMistakes + 1) : 1;
      printf("You have made %d mistakes! \n",*currentNumberMistakes );
      printf("You have %d tries left\n", (*thresold - *currentNumberMistakes) );
}

bool wonGame (int* numberOfRightLetters , char* wordToBeGuessed) {
    bool wonIt = false ;
    (*numberOfRightLetters == strlen(wordToBeGuessed)) ? wonIt = true: 1;
    return wonIt;
}

bool gotHanged (int* mistakesHad , int* threshold) {
    bool gameOver = false;
    (*mistakesHad >= *threshold) ? gameOver = true: 1;
    (gameOver) ? (printf("You got HANGED! Better luck next time!\n")): 1 ;
    return gameOver;
}

void writeWordFile(){

    char addWord;
    int numOfWords;

    printf("Would you like to add a new word to the game? (Y/N)\n");
    scanf(" %c", &addWord );
    bool scape = false;

    if (addWord == 'Y'){

        FILE *f;
        f = fopen("palavras.txt", "r+");
         if (f == 0) {
            printf("Error while opening file \n");
            exit(1);
        }
        else {
            char newWordDataBase[26];


            while (!scape){
                printf("Please type the new word \n");
                memset(newWordDataBase,0,26);
                scanf("%s", newWordDataBase );
                printf("Please type 1 if you wish to confirm the word\n");
                scanf("%d", &scape);
                if (scape == 1) {
                    break;
                }
                else{
                    printf("Word was erased!!\n");
                    continue;
                }
            }

            fscanf(f,"%d", &numOfWords);
            numOfWords++;

            fseek(f,0,SEEK_SET);
            fprintf(f,"%d", numOfWords);

            fseek(f,0,SEEK_END);

            fprintf(f, "\n%s", newWordDataBase);
        fclose(f);
        }
    }
    else{
        printf("Okay then! Thank you for playing the hangman game! \n\n");
    }

}
