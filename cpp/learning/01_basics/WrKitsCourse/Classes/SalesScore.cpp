/**
    SalesScore: A class who simulates a Enterprise system
    @file SalesScore.cpp
    @author André Biasuz, EE.
    @version 1.0 - XX/08/2022
    @version 1.1 - 16/08/2022 - M02_A05 - Added SetSoldProduct and GetSoldProduct in a very rudimentary form. 
 

   ****Improvements to come: Improve reuseability of all member functions.
*/

#include <iostream>
#include <string>
using namespace std;
#include "SalesScore.hpp"

SalesScore::SalesScore(string title) // constructor
{
    setStoreTitle(title);
    prodA = 0;
    prodB = 0;
    prodC = 0;
}

// properties
void SalesScore::setStoreTitle(string title)
{
    if (title.length()<= 20)
        storeTitle = title;
    else {
        cout << title << " has been shortened due to character constraints." << endl;
        cout << endl;
        storeTitle = title.substr(0,20); 
        
    }
}

string SalesScore::getStoreTitle() 
{
    return storeTitle;
}

// old boot system, without constructor
void SalesScore::bootSystem(string storeTitle)
{
    cout << "Sales Score !" << endl;
    cout << storeTitle << endl;
}

// store as private the variable took from the set property. 
string storeTitle;

void SalesScore::setSoldProducts() {

    int productCode;
    
    cout << "Enter sold product or Ctrl+d to finalize query : ";
    while ( (productCode = cin.get()) != EOF)
        {
            
            switch(productCode) {
                case '1' :
                    prodA++;
                    break;
                 case '2' :
                    prodB++;
                    break;      
                 case '3' :
                    prodC++;
                    break;
                case '\n' :
                case '\t' :
                case ' '  :
                    break;
                default:
                    cout << "Please insert a valid product." << endl;
            }
        }
    
        SalesScore:getSoldProducts();
}

void SalesScore::getSoldProducts() {
    cout << endl;
    cout << "Products Sold:" << endl;
    cout << "Code 1: " << prodA << " products" << endl;
    cout << "Code 2: " << prodB << " products" << endl;
    cout << "Code 3: " << prodC << " products" << endl;
        
}
	
