public class SavingsAccount extends BankAccount{


    public void moneyDeposit(double Value, double tariff) {
        accountHolderAmount = (Value + accountHolderAmount);
    }


    public void moneyDeposit(double Value) {
        accountHolderAmount = (Value + accountHolderAmount);
    }

    public SavingsAccount(String accountHolderName, String accountHolderNumber, double accountHolderAmount, AccountTypes backAccountType) {
        super(accountHolderName, accountHolderNumber, accountHolderAmount, backAccountType);
    }

    public SavingsAccount() {
    }

    @Override
    public String toString() {
        return "SavingsAccount{" +
                "accountHolderName='" + accountHolderName + '\'' +
                ", accountHolderNumber=" + accountHolderNumber +
                ", accountHolderAmount=" + accountHolderAmount +
                ", backAccountType=" + backAccountType +
                '}';
    }
}
