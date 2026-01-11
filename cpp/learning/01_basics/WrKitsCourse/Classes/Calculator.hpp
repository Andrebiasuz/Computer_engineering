#include <iostream>
#include <string>
using namespace std;

class Calculator
{

    public:

        Calculator(string title) ;
        void  setCalculatorTitle(string title);
        string getCalculatorTitle();
        float multiply(float num1, float num2);
        float sum(float num1, float num2);
        float substract(float num1, float num2);
        float divide(float num1, float num2);
        int modulo(int num1, int num2);
        string evaluateSize(float num1, float num2);

    private:
        string calculatorTitle;
	
};
