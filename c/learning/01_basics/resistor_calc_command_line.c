/* ===========================================================================
write a program that you type ohm followed by the voltage and current parameters, and the resistance value is calculated, remembering that 𝑅=𝑉𝐼
Example: you type ohm 12 1 15 2 5 0.001
And the result will be printed in the following format
Resistors: 12.0 | 7.5 | 5000.0 | Ohms

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


/* ========================================================================= */
/* --- Main routine --- */

int main(int argc, char *argv[])
{    
    int i;
    float current, resistor, voltage;
    printf("Voltage(V)\tCurrent(A)\tResistor(Ohms)\t\n");

    for (i = 1 ; i < argc ; i = i+2) {

        // very basic code just to prove concept of CLI running of functions and programs
        // using atof to prevent further complexity, Seg fault not handled
        voltage = atof(argv[i]);
        current = atof(argv[i+1]);

        resistor = voltage / current ;
        printf("%.2f\t%.2f\t%.2f\n", voltage,current, resistor);
        voltage = 0;
        current = 0;
    }
 
}

/* ========================================================================= */
/* --- Functions' development --- */


/* ========================================================================= */
/* --- End of Program --- */
