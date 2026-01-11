public interface Account {

    void viewAccountBalance();
    void  moneyDeposit(double Value, double tariff);
    void accountTransfer(BankAccount accountNumberWithdraw , BankAccount accountNumberDeposit, double valueTransfer);
    // TODO: Wanted to use default input parameters, Java does not handle it.
    // Check https://stackoverflow.com/questions/997482/does-java-support-default-parameter-values
}


