#include <iostream>
using namespace std;

int main(){
        
    int grade1;
    int index = 1;
   
    while (index) {
        
        cout << "Input student grade: ";
        cin >> grade1;
        cout << endl;
        
        if ( grade1 >= 0 && grade1 <= 100) {
            cout << ((grade1 >= 90 && grade1 <= 100) ? "Grade A" :
                    (grade1 >= 80 && grade1 <= 90) ? "Grade B" :
                    (grade1 >= 70) ? "Grade C" : "You have been denied.");
        }
        else {
            cout << "Invalid input" << endl;
        }
        
        grade1 = 0;
        
        cout << "\nAnother result? Push 0 to end: ";
        cin >> index;
        
        cout << endl;
        cout << endl;
    }
    while(1);
    return 0;
}
