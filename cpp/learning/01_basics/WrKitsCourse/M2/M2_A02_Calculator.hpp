/*
    Refer to .cpp file  for full documentation
*/
#include <iostream>
#include <string>
#include <iomanip>      // std::setw
using namespace std;


class Calculator_M02
{

    public:

    Calculator_M02(string title);
    void setCalculatorTitle(string title);
    string getCalculatorTitle();
    float multiply(float num1, float num2);
    float sum(float num1, float num2) ;
    float substract(float num1, float num2);
    float divide(float num1, float num2) ;
    int modulo(int num1, int num2);
    void set6Inputs();
    void set2Inputs();    
    void getResultsA01computation();
    void lineEquation(int i1, int i2, int i3, int i4);
    void GetSwitchResults();

    private:
        int num1, num2, num3, num4, num5, num6;
        string calculatorTitle;
};
