public abstract class BankAccount implements Account {

    String accountHolderName;
    String accountHolderNumber;
    double accountHolderAmount;
    AccountTypes backAccountType;


    @Override
    public void viewAccountBalance() {
        System.out.println("The account balance of account " + accountHolderNumber + " is: " + accountHolderAmount + ".");
    }

    @Override
    public abstract void moneyDeposit(double Value, double tariff);

    public void accountTransfer(BankAccount accountNumberWithdraw , BankAccount accountNumberDeposit, double valueTransfer)
    {
        accountNumberWithdraw.accountHolderAmount -= valueTransfer ;
        accountNumberDeposit.accountHolderAmount += valueTransfer;
    }

    public BankAccount(String accountHolderName, String accountHolderNumber, double accountHolderAmount, AccountTypes backAccountType) {
        this.accountHolderName = accountHolderName;
        this.accountHolderNumber = accountHolderNumber;
        this.accountHolderAmount = accountHolderAmount;
        this.backAccountType = backAccountType;
    }

    public BankAccount() {
    }

    @Override
    public String toString() {
        return "BankAccount{" +
                "accountHolderName='" + accountHolderName + '\'' +
                ", accountHolderNumber=" + accountHolderNumber +
                ", accountHolderAmount=" + accountHolderAmount +
                ", backAccountType=" + backAccountType +
                '}';
    }
}
