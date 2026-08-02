/* ===========================================================================
Proposed Exercise: Develop the design of a program to encrypt text files, that moves the characters typed 3 positions forward. Example:

Original message: Curso de C
Encrypted message: Fxuvr#gh#F

Develop a software to remove the encryption and generate a new file with the original message. Example:

Encrypted message: Fxuvr#gh#F
Encryption removed: Curso de C

Autor: Eng. André Biasuz
Date:  November 2022

 KNOWN INTERATIONS TO FOLLOW AFTER STABLE BUILD:
    - ALLOW MORE THAN ONE-LINE INPUTS
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
FILE *open_file(char* filename, char* mode);
void file_write(char *file_name);
void *crypto_3_ASCII(char* input_file_name, char* output_file_name);
//void file_destroy_contents(char *file_name);
/* ========================================================================= */
/* --- Main routine --- */

int main(int argc, char *argv[])
{    
  //char string_to_file[256];
  
  char file1_name[30] = "crypto.txt";
  char file2_name[30] = "decoded.txt";    
  
  file_write(file1_name);
  crypto_3_ASCII(file1_name, file2_name);
}

/* ========================================================================= */
/* --- Functions' development --- */

/**
 * OPENS A FILE 
 * PARAMETERS : name of file (char) , mode of file opening (char)
 * RETURNS : FILE pointer. 
**/
FILE *open_file(char* filename, char* mode)
        
{
    FILE *f;
    f = fopen(filename, mode);
    if(!f)
    {
        perror(filename);
        exit(0);
    }

    return f;
}

/**
 * WRITES INTO TXT FILE FROM STDIN
 * PARAMETERS : name of file (char)
 * RETURNS : NULL 
**/
void file_write(char *file_name) {
    
    // string and file pointer declaration
    char content[256];
    FILE *f1 = fopen(file_name, "a");

    // gets ONE Line string from stdin
    fgets(content, sizeof(content), stdin);

    // points stdin to file and prints it
    fprintf(f1 , "%s", content);

    // close the file
    fclose(f1);
}

/**
 * GETS CONTENT FROM INPUT FILE AND CRIPTOGRAFS TO OUTPUT BY SHIFTING THE CHARACTER 3 POSITIONS FORWARD    * IN THE ASCII TABLE
 * PARAMETERS : name of input file (char) ,  name of output file (char)
 * RETURNS : VOID
**/
void *crypto_3_ASCII(char* input_file_name, char* output_file_name) {
    //file pointer declaration
    FILE *input,*output; 

    // open input file to read contents
    input = open_file(input_file_name,"r");

    // open output file to write(append) cryptograph contents
    output = open_file(output_file_name, "a");

    // char to get the value and also serve as EOF tag
    int ch; 

    // sweeps the characters in input file and prints in output file the input value shifted 
    // 3 values in the ASCII table
    while((ch = fgetc(input)) != EOF) {
        fputc (ch + 3, output);
    }

    // close the files
    fclose(input);
    fclose(output);    
}
/* ========================================================================= */
/* --- End of Program --- */
