/* ==========================================================================
design a recursive function to print the numbers from 1 to n, where n is the number passed as parameter to the function.
   
    Autor: Eng. André Biasuz
    Date:  November 2022

 KNOWN INTERATIONS TO FOLLOW AFTER STABLE BUILD:
- 
============================================================================ */

/* --- Libraries  --- */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* ========================================================================= */
/* --- Constants and Macros --- */
// define how many levels the stack will have

/* ========================================================================= */
/* --- Global variables --- */

/* ========================================================================= */
/* --- Prototypes --- */
void print0_to_num_recursive(int num);

/* ========================================================================= */
/* --- Main routine --- */

int main(int argc, char *argv[])
{    
    print0_to_num_recursive(355);
  
}

/* ========================================================================= */
/* --- Functions' development --- */
void print0_to_num_recursive(int num) {
    static int n, limit;
    if (n == 0) {
        puts("Function prints 0 to functional variable. It was developed to be recursive\n");
        limit = num;
        }
    printf("%d\t", n);
    n++;
    if (n >= limit){
        puts("");
        return;
        }
    print0_to_num_recursive(n);  
}

/* ========================================================================= */
/* --- End of Program --- */
