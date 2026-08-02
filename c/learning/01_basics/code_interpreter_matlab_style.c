/* ===========================================================================
    Develop the design of an interpreter for the following instructions:
    RUN - run the interpreter.
    RUN SOUND - run the interpreter with "beeps".
    REP - sets the number of repetitions of a phrase previously saved with the TXT command. Receives as argument the desired number of repetitions.
    TXT - command for entering a new phrase. The argument is the text phrase you want the interpreter       to run for the number of repetitions set.
    CLEAR - clears the console screen.
    CLEAR ALL - clears the screen and restores variables.
    EXIT - terminates the interpreter.
    HELP - displays the current interpreter version and a brief explanation of its commands.

    Autor: Eng. André Biasuz
    Date:  October 2022

 KNOWN INTERATIONS TO FOLLOW AFTER STABLE BUILD
    1 - USE OF GETS SHOULD BE BANNED. 
    2 - TXT COMMAND DOES NOT GET MORE THAN ONE LINE (USE GETDELIM) - GOOD MATERIAL AT https://www.studymite.com/blog/strings-in-c
    3 - REP FUNCTION SHOULD TAKE NUMBER OF REPETITION IN THE COMMAND, I.E ("REP 10"), REPEATS IT TEN TIMES. 
    4 - USE CLEAR ALL MORE INTELIGENTLY BY STORING ALL VARIABLES IN A STRUCT OR ARRAY AND THEN CLEARING THE ARRAY. MORE ON https://stackoverflow.com/questions/18577404/how-can-mixed-data-types-int-float-char-etc-be-stored-in-an-array
    5 - ALLOCATE DYNAMIC MEMORY SPACE FOR THE TXT INPUT. A LITTLE MORE ON https://stackoverflow.com/questions/24578072/gets-and-puts-to-get-and-print-a-string

============================================================================ */

/* --- Libraries  --- */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* ========================================================================= */
/* --- Constants and Macros --- */

#define MAX_STRING_LENGHT 20

/* ========================================================================= */
/* --- Global variables --- */

char interpreter_text[255] = "";
unsigned int run_repetitions = 1;
/* ========================================================================= */
/* --- Prototypes --- */

void play_sound();
void *get_text(char *str);
void  menu_selector();
void run_command();
void run_command_with_repetitions(unsigned int repetitions);
void help_script();

/* ========================================================================= */
/* --- Main routine --- */

int main()
{

    menu_selector();     

    return 0;
}


/* ========================================================================= */
/* --- Functions' development --- */
void play_sound() 
{
    printf("\a");
    puts("Sound played");
}

void *get_text(char *str) 
{
    gets(str);   
    //puts(str);
}

void menu_selector() 
{
    char str[MAX_STRING_LENGHT];
    
    while(1) 
        {
        strcpy(str, " ");
        get_text(str);
    
        if (!strcmp("RUN", str))
        {
            run_command_with_repetitions(run_repetitions);
            puts(interpreter_text);
        }    
        else if (!strcmp("RUN SOUND", str))      
        {
            play_sound();
            run_command_with_repetitions(run_repetitions);
            
        }    
    
        else if (!strcmp("REP", str))
        {
            //static unsigned int run_repetitions = 1;
            printf("Enter interpreter repetitions: ");
            scanf("%u", &run_repetitions);
            printf("\n");
        }   
        else if (!strcmp("TXT", str))
        {
            printf("Enter desired text: ");
            get_text(interpreter_text); 
            puts(interpreter_text);
        }   
        else if (!strcmp("CLEAR", str))
        {
            system("clear");   
        }   
        else if (!strcmp("CLEAR ALL", str))
        {
            strcpy(interpreter_text, "");
            run_repetitions = 1;
        }   
        else if (!strcmp("EXIT", str))
        {
            break;
        }   
        else if (!strcmp("HELP", str))
        {
            help_script();
        }   
        else if (!strcmp("", str))
        {
            
        }   
        else {
            puts("Invalid sintax");
        }
    }
}

void run_command() {
    puts(interpreter_text);
}

void run_command_with_repetitions(unsigned int repetitions){
    static int i ;
    for (i = 0; i < repetitions ; i++) {
        run_command();
    }
}

void help_script(){
    printf("\nHELP PAGE:\n\n\tRUN - run the interpreter.\n\tRUN SOUND - run the interpreter with ""beeps"".\n\tREP - sets the number of repetitions of a phrase previously saved with the TXT command. Receives as argument the desired number of repetitions.\n\tTXT - command for entering a new phrase. The argument is the text phrase you want the interpreter to run for the number of repetitions set.\nCLEAR - clears the console screen.\n\tCLEAR ALL - clears the screen and restores variables.\n\tEXIT - terminates the interpreter.\n\tHELP - displays the current interpreter version and a brief explanation of its commands.\n");
}

/* ========================================================================= */
/* --- End of Program --- */
