#include <iostream>
#include <string>
using namespace std;

#include "Calculator.hpp"

Calculator::Calculator(string title) {
    setCalculatorTitle(title);
} 

void Calculator::setCalculatorTitle(string title)
{
        calculatorTitle = title;
}

string Calculator::getCalculatorTitle() 
{
    return calculatorTitle;
}

float Calculator::multiply(float num1, float num2) {
    return num1*num2;
}

float Calculator::sum(float num1, float num2) {
    return num1+num2;
}

float Calculator::substract(float num1, float num2) {
    return num1-num2;
}

float Calculator::divide(float num1, float num2) {
    return num1/num2;
};

int Calculator::modulo(int num1, int num2) {
    return num1 % num2;
}

/*char Calculator::*evaluateSize(float num1, float num2) {
        if (num1 > num2){
        return sprintf("%.2f is greater than %.2f", num1 , num2);
    }
    else if (num1 == num2){
        return str::format("{} and {} are equal", num1 , num2);
        return 0;
    }
    return str::format("{} is greater than {}", num2 , num1);
} */
