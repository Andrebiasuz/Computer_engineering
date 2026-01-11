/* ===========================================================================
The protocol function  implements a protocol that checks two operands. If the first operand is higher, the function returns an 'H' for high, otherwise it returns an 'L' for low. Implement a function that will receive two integer operands and the protocol function as parameter, interpreting the protocol correctly. The function will present the following output:
"Protocol result: H" for when the first operand is greater. Otherwise: "Protocol result: L"
    Autor: Eng. André Biasuz
    Date:  November 2022

 KNOWN INTERATIONS TO FOLLOW AFTER STABLE BUILD:

============================================================================ */

/* --- Libraries  --- */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* ========================================================================= */
/* --- Constants and Macros --- */

/* ========================================================================= */
/* --- Global variables --- */

/* ========================================================================= */
/* --- Prototypes --- */
char protocol(int op1, int op2);
void evaluate_two_operands(int n1, int n2, char (*function) (int n1, int n2));

/* ========================================================================= */
/* --- Main routine --- */

int main()
{    
    evaluate_two_operands(85,58,protocol);
}

/* ========================================================================= */
/* --- Functions' development --- */

char protocol(int op1, int op2)
{
    char response;
    response = op1 > op2 ? 'H' : 'L';
    return response;
} /* end protocol */

void evaluate_two_operands(int n1, int n2, char (*function) (int p1, int p2)){
    char opt1 = (*function)(n1,n2);
    printf("Protocol result: %c \n", opt1);
    }

/* ========================================================================= */
/* --- End of Program --- */
