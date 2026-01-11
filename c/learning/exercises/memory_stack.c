/* ===========================================================================
Design a C memory stack that contains 16 levels, where each level will store one byte. To show the stack, the addresses and data must be presented in hexadecimal format.
    Version control: 10.11.2022 - Version 0 
    Autor: Eng. André Biasuz

 KNOWN INTERATIONS TO FOLLOW AFTER STABLE BUILD:

    1 - SAVE STACK IN FILE AND READ STACK FROM FILE

============================================================================ */

/* --- Libraries  --- */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <limits.h>

/* ========================================================================= */
/* --- Constants and Macros --- */
// define how many levels the stack will have
#define STACK_LEVELS 16
/* ========================================================================= */
/* --- Global variables --- */
int overflow_flag = 0;
// values has to be only one byte long, then lets store in char.
char value = 0;
// declare pointers. 
char *ptr1, *ptr2; // ptr1 is the base stack , ptr2 is the adress of the current stack in the memory stack


/* ========================================================================= */
/* --- Prototypes --- */
// menu
// print stack
void print_stack();
// pop value (LIFO)
char pop();
    // delete address from top of stack. 
// insert value (LIFO)
void push();
    // create address to insert value
// check if stack is full (STACK OVERFLOW)
void stack_is_full();
// check if stack is empty
void menu();


/* ========================================================================= */
/* --- Main routine --- */

int main()
{    
    puts("*****MEMORY STACK ALLOCATION****");
    puts("");

    ptr1 = &value;
    ptr2 = ptr1; //  pointer2 points to same adress of ponter1 to begin the stack. 

    while(1) {

    stack_is_full();
    menu();
  
    }
   
    return 0;
}

/* ========================================================================= */
/* --- Functions' development --- */

// menu
void menu(){

    char opt[256];
    char *endptr;    
    double switch_opt;
    int opt_int = 0;
    puts("************Menu*************");
    puts("Please select desired action:");
    puts("1 - Print stack");
    puts("2 - Pop value from stack");
    puts("3 - Insert value in stack");
    puts("4 - Exit");   
    printf(">>>> ");
    fgets(opt,20,stdin);         //#input from stdin stream
    switch_opt = strtod(opt, &endptr);
    opt_int = (int)switch_opt; 
    puts("");
 
    switch(opt_int){
        case 1:  {
            print_stack();               
            break;
        }
        case 2:  {
            pop();
            break;
        }
        case 3:  {
            if (overflow_flag) puts("Stack is overflowed, you have to pop something to insert anything");
            else push();
            break;
        }
        case 4:  {
            exit(0);
            break;
        }
        default: {
            puts("Incorrect value, please select according to menu.");
        }
    }
   
}


void print_stack(){
    unsigned char i = 0;
    
    for (i = 0 ; i <= (STACK_LEVELS - (STACK_LEVELS - (ptr2-ptr1 - 1))); i++){
        printf("Level %p:\t Value: %p\t Adress: %p\n", i + 1, *(ptr1+i), ptr1+i);
    }
    puts("");
}

// pop value (LIFO)
char pop(){
    
    // get value from top of shelf
    ptr2--;
    
    char pop_value = *ptr2;
    
    printf("Popped value is %p\n", pop_value);
    *ptr2 = NULL;
    
}

// insert value (LIFO)
void push(){
    char inserted_value = 0;
    char stack_value = 0;
    
    // aux variables for input conversion from string to long
    char pushed_value[256];
    char *eptr;
    long int result;

    while(1) {
        printf("Input value to be inserted in stack >>>> ");
        
        fgets(pushed_value,20,stdin);     //input from stdin stream
        result = strtol(pushed_value, &eptr, 10);
    
        if ((result >= SCHAR_MIN) && (result <= SCHAR_MAX)){
            stack_value = result;
            break;
        }
        else puts("Invalid");
    }
    
    if (ptr2 == ptr1) 
    {
        *ptr1 = stack_value;
        ptr2++;
        }
    else {    
            *ptr2 = stack_value; 
            ptr2++;
        }
    puts("");
    
}

// check if stack is full (STACK OVERFLOW)
void stack_is_full(){

    if ((ptr2 - ptr1) > STACK_LEVELS) {
        puts("STACK OVERFLOW!");
        puts("");
        
        overflow_flag = 1;
    } 
    else{
        overflow_flag = 0;
    }
        
    
}

/* ========================================================================= */
/* --- End of Program --- */
