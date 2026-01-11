/*
    Refer to .cpp file  for full documentation
*/

#include <iostream>
#include <string>
using namespace std;

class SalesScore
{

    public:

    	SalesScore(string title); // constructor
        void setSoldProducts();
        void getSoldProducts();
    	void setStoreTitle(string title);
    	string getStoreTitle();
    	void bootSystem(string storeTitle);

	private:
    	string storeTitle;
        int prodA, prodB, prodC;
	
};

