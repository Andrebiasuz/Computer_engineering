/**
M03_A01 :Insert the option to allow enter a specific range of
random numbers to to be generated in the software, as well as the option to
arrange the information in the desired number of columns desired number of
columns
Develop a function to return the value of the sum of the random numbers
generated and show the result on the screen
@file M03A01.cpp
@author André Biasuz, EE.

@version 1.0 - 22/08/2022
@version 1.1 - 30/08/2022 - Implemented sum, fixed C11 issue
*/

#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <string>
#include <time.h>

using namespace std;

void RandomNumbers(int lowLimit, int highLimit, int numberColumns,
	int qtdNumbersRequested);

int main() {
	RandomNumbers(1, 10, 5, 5);
}


void RandomNumbers(int lowLimit, int highLimit, int numberColumns,
	int qtdNumbersRequested) {


	int rangeRandomNumbers = highLimit - lowLimit;
	int number = 0, sum = 0;
	int i = 0, j = 0;

	srand(time(NULL));
	cout << "Random numbers selected: " << endl;

	for (i = 0; i < qtdNumbersRequested; i++) {
		number = rand() % rangeRandomNumbers + lowLimit;
		sum += number;
		if ((j % (numberColumns + 1)) == 0) {
			cout << endl;
		}

		cout << setw(5);
		cout << number;
		j++;
	}

	cout << endl;

	cout << "Sum of randomized values is: " << sum << " ." << endl ;

}
