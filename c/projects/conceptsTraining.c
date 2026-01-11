#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>

/*void somaArray(int arr[], int size) {
    int res = 0;
    for (int idx = 0 ; idx < size ; idx++) {
        res += arr[idx];
        printf("%d\n", res);
    }
}

int main() {
    int tuy[11] = {1,2,3,4,5,6,7,8,9,10,11} ;
    int a = 25;
    int b = 32;
    somaArray(tuy, sizeof(tuy) / sizeof(tuy[0])); pass size of the array.
    Get array and divide by size of pointer
}  */


int sum (int* x1 , int* x2) {
    int sum = *x1 + *x2 ;
    return sum;
}

void potencia(int* result, int* x1 , int* x2) {
    *result = 1;
    for (int idx = 1 ; idx <= *x2 ; idx ++) {
        *result *= *x1;
    }
    printf("resultado da potencia %d \n", *result );
}

int somapoint( int* nums, int MaxIdxToSum) {
    int result = 0;
    for (int idx = 0 ; idx <=  MaxIdxToSum ; idx++) {
        result += nums[idx];
    }
    return result;
}

int main() {
    int a = 25;
    int b = 32;
    int d = 2 ;
    int potenciares = 0;
    int result = sum(&a , &b);
    printf("Result is %d\n", result );
    potencia( &potenciares, &a, &d);

    int nums[3] = {10,20,30};
    int maxIdx = 2;
    int total = somapoint(nums, maxIdx);
    printf("Total is %d\n", total );
}
