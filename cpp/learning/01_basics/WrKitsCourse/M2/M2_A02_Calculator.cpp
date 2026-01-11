/**
    M02_A02 : Make a C++ class that contains a constructor to generate an initialization message and a function where the user will enter 6 integers After entering the 6 numbers, the system output will print the sum of the first and second numbers, the subtraction between the third and fourth numbers, and the multiplication between the fifth and sixth numbers entered
    @file Calculator_M02.cpp
    @author André Biasuz, EE. 
    @version 1.0 - 10/08/2022
    @version 1.1 - 14/08/2022 - A03 - Include line equation class
    @version 1.2 - 15/08/2022 - A04 - Include calculator class using switch cases

   ****Improvements to come: Improve reuseability of all member functions. 


*/

#include "Calculator_M02.hpp"
using namespace std;

Calculator_M02::Calculator_M02(string title) {
    setCalculatorTitle(title);
} 

void Calculator_M02::set2Inputs() {
        cin >> num1 >> num2;
    }

void Calculator_M02::set6Inputs() {
        cout << num1 << num2 << num3 << num4 << num5 << num6 << endl;
    }

void Calculator_M02::setCalculatorTitle(string title)
{
        calculatorTitle = title;
}

string Calculator_M02::getCalculatorTitle() 
{
    return calculatorTitle;
}

float Calculator_M02::multiply(float num1, float num2) {
    return num1*num2;
}

float Calculator_M02::sum(float num1, float num2) {
    return num1+num2;
}

float Calculator_M02::substract(float num1, float num2) {
    return num1-num2;
}

float Calculator_M02::divide(float num1, float num2) {
    return num1/num2;
};

int Calculator_M02::modulo(int num1, int num2) {
    return num1 % num2; 
} 

void Calculator_M02::getResultsA01computation(){
    cout << "Results of computation: " << endl;
    cout << endl;
    cout << num1 << " + " << num2 << " = " << Calculator_M02::sum(num1,num2) << endl;
    cout << num3 << " - " << num4 << " = " << Calculator_M02::substract(num3,num4) << endl;
    cout << num5 << " * " << num6 << " = " << Calculator_M02::multiply(num5,num6) << endl;
}


/* Function lineEquation works as y = Mx + b. 
    Inputs: i1 = M,  i2 = b, i3 and i4 are the interval of x, e.g [-42,58] 
    Output: Writes to console as two-row table */
void Calculator_M02::lineEquation(int i1, int i2, int i3, int i4) {

    float res = 0;
    
    cout << "Results for y = " << i1 << "x + " << i2 << " computation: " << endl;
    cout << endl;
    cout << setw(5) << "X" << setw(5) << "Y" << endl;
    
    for (int j = i3 ; j <= i4 ; j++) {
        res = i1 * j + i2 ;//
        cout <<  setw(5) << j << setw(5) << res << endl;
    }
       
}

void Calculator_M02::GetSwitchResults() {
    int i1, i2;
    float res = 0;
    char opt;
    int scape = 0;

    do {
    cout << "Enter 2 inputs for computation: ";
    Calculator_M02::set2Inputs();
    cout << endl;
    
    i1 = num1;
    i2 = num2;
    cout << "Enter desired arithmetic operation:  " ;
    cin >> opt; 
    cout << endl;

    
    switch(opt) {
        
        case '+':
            res = Calculator_M02::sum(i1, i2);
            break;
        case '-':
            res = Calculator_M02::substract(i1, i2);
            break;    
        case '/':
            res = Calculator_M02::divide(i1, i2);
            break;    
        case '*':
            res = Calculator_M02::multiply(i1, i2);
            break;        
        case '%':
            res = Calculator_M02::modulo(i1, i2);
            break;
        default:
            cout << "Invalid character" << endl;
    }
        cout << "Result is : " << res << endl;

        cout << "Type 0 to scape or any number to repeat: " ;
        cin >> scape;
        cout << endl;
        
        } while(scape != 0);
}
