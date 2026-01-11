#include <iostream>


int main() {
    int num1, num2;
    
    std::cout << "Insert two numbers: ";
    std::cin >> num1 >> num2;

    std::cout << std::endl;
     
    std::cout << num1 << " + " << num2 << " = " << num1 + num2 << std::endl;
    std::cout << num1 << " - " << num2 << " = " << num1 - num2 << std::endl;
    std::cout << num1 << " * " << num2 << " = " << num1 * num2 << std::endl;
    std::cout << num1 << " / " << num2 << " = " << float(num1) / float(num2) << std::endl;
    std::cout << num1 << " % " << num2 << " = " << num1 % num2 << std::endl;

    if (num1 > num2){
        std::cout << num1 << " is greater than " << num2 << std::endl;
        return 0;
    }
    else if (num1 == num2){
        std::cout << num1 << " is equal than " << num2 << std::endl;
        return 0;
    }
    std::cout << num1 << " is less then " << num2 << std::endl;
    
}
