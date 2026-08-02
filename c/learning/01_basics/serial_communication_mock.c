
/* Proposed Exercise: A digital temperature sensor can read values in the range -255 to +255 (Celsius or Fahrenheit) 
and sends serial data from the protocol illustrated in Figure 1 in 2-byte format. The first 4 bits of the most 
significant byte consist of the protocol information itself, standard defined in Ah. 
The next 2 bits consist of the error indicators (sensor out of range, communication failure, etc.) 
and will be 0 when everything is ok. The next bit is the sign bit, which will be 0 for positive and 1 for negative. 
Next comes the unit bit, which will be 0 for Celsius and 1 for Fahrenheit. 
The least significant byte is reserved for the value  value of the temperature itself. */

/* ============================================================================

Autor: Eng. André Biasuz
Date:  Mar 2023
============================================================================ */

/* --- Libraries  --- */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>
#include <time.h>
//#include <unistd.h>

/* ========================================================================= */
/* --- Constants and Macros --- */
#define FILE_NAME "protocol.txt"
/* ========================================================================= */
/* --- Global variables --- */
/* ========================================================================= */
/* --- Prototypes --- */
short getTemperatureValue();
char negative_test(short value);
unsigned char convertToBynary(short value);
void print_byte(unsigned char reg);
unsigned char unit();
unsigned char errorFlag();
void print_2_byte(unsigned int reg);
char *time_stamp();
FILE *open_file_check_error(char* file_name , char* file_open_id);
void write_in_file_log(char* file_name, char* message, unsigned long size_message);
char *binarytochar(unsigned int byte) ;
void write_in_file_header(char* file_name);
void string_manipulation();
/* ========================================================================= */
/* --- Main routine --- */

int main(int argc, char *argv[])
{    
    
    short Temperature;
    char isNegative = 0, unit_bit, error_bit;
    unsigned char byte = 0x00;
    unsigned char protocol_default_session = 0x0A;
    unsigned int full_message = 0x00;
    char ch ;
    FILE *f;
    char stringb[20];
    char string_file[32];

    write_in_file_header(FILE_NAME);
    
    while(1) {
              
    Temperature = getTemperatureValue();  
    isNegative = negative_test(Temperature);
    byte = convertToBynary(Temperature);
    unit_bit = unit();
    error_bit = errorFlag(); 
   
    full_message = protocol_default_session << 12 | error_bit << 10 | isNegative << 9 | unit_bit << 8 | byte;
    
    string_manipulation(stringb, byte, string_file);
    
    write_in_file_log(FILE_NAME, string_file, sizeof(string_file)/sizeof(string_file[0]));

    sleep(2);
        
    memset(stringb,0,strlen(stringb));
    memset(binarytochar(byte),0,strlen(binarytochar(byte))); 
    memset(string_file,0,strlen(string_file));
    };
    
}
/* ========================================================================= */
/* --- Functions' development --- */
short getTemperatureValue(){
    short inputTemperature = 0;
    do{
        printf("Insert temperature value: ");
        scanf("%hd", &inputTemperature);
    } while(inputTemperature < -255 || inputTemperature > 255);

    return inputTemperature;
}

char negative_test(short value) {
    if (value < 0) {
        return 1;
    }
    else return 0;
}

unsigned char unit () {
    char unit;
    do {
        printf("Fahrenheit(F) or Celsius(C)?");
        scanf(" %c", &unit);
        unit = toupper(unit);
    } while(!(unit == 'F' || unit == 'C'));
    if (unit == 'F') return 1;
    if (unit == 'C') return 0;
}

unsigned char convertToBynary(short value) {

    value = abs(value);
    short temp;
    unsigned char bynary = 0x00;
    unsigned char shift = 0x01;
    temp = value;
    while (temp != 0) {
        if (temp % 2) bynary |= shift; 
        shift = shift << 1 ;
        temp /= 2;    
    }
    return bynary;      
}

unsigned char errorFlag(){
    srand(time(NULL));   // Initialization, should only be called once.
    unsigned char byte = rand() % 4;      // Returns a pseudo-random integer between 0 and 3
    return byte;
}

void print_byte(unsigned char reg)
{
    register int i;
    for(i=7;i>=0;i--) (reg>>i)&1 ? putchar('1') : putchar('0');
    putchar('b');
    putchar('\n');

}

void print_2_byte(unsigned int reg)
{
    register int i;
    for(i=15;i>=0;i--) (reg>>i)&1 ? putchar('1') : putchar('0');
    putchar('b');
    putchar('\n');
}

// from Stack Overflow

char *time_stamp(){

    char *timestamp = (char *)malloc(sizeof(char) * 16);
    time_t ltime;
    ltime=time(NULL);
    struct tm *tm;
    tm=localtime(&ltime);
    
    sprintf(timestamp,"%04d%02d%02d%02d%02d%02d", tm->tm_year+1900, tm->tm_mon, 
        tm->tm_mday, tm->tm_hour, tm->tm_min, tm->tm_sec);
    return timestamp;
}

FILE *open_file_check_error(char* file_name , char* file_open_id) {
    
    FILE *f;
    
    f = fopen(file_name , file_open_id);
    
    if (f == NULL){
        puts("Error");
        system("pause");
        exit(-1);
    } 

    return f;
    
}

void write_in_file_log(char* file_name, char* message, unsigned long size_message){
    FILE *f;

    f = open_file_check_error(file_name, "a");
    fwrite(message,size_message,sizeof(char),f);

    fwrite("\n",1,sizeof(char),f);
    
    fclose(f);
}

void write_in_file_header(char* file_name){
    FILE *f;

    f = open_file_check_error(file_name, "a");

    fwrite("Time\t\t\tBinary\n\n",14,sizeof(char),f);
    
    fclose(f);
}

char *binarytochar(unsigned int byte) {
    char *string = (char *)malloc(sizeof(char) * 40);
    register int i;
    for(i=15; i>=0 ;i--) 
        {
        if ((byte>>i)&1) 
            {  
            string[i] = '1';
                }
        else {
            string[i] = '0';
                 }
        }
    string[16] = 'b';
    return string;
      
}

void string_manipulation(char* stringb, unsigned int byte, char* string_file) {
    
    strcpy(stringb, binarytochar(byte)); 
    strcpy(string_file, time_stamp());        
    strcat(string_file, "\t");
    strcat(string_file, stringb);
}
/* ========================================================================= */
/* --- End of Program --- */
