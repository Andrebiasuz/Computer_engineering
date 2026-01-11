public class CheckingAccount extends BankAccount{


    public void moneyDeposit(double Value, double tariff) {
        accountHolderAmount = (Value - (Value * (tariff / 100))) + accountHolderAmount;
    }


    public CheckingAccount(String accountHolderName, String accountHolderNumber, double accountHolderAmount, AccountTypes backAccountType) {
        super(accountHolderName, accountHolderNumber, accountHolderAmount, backAccountType);
    }

    // Constructors
    public CheckingAccount() {
    }

    @Override
    public String toString() {
        return "CheckingAccount{" +
                "accountHolderName='" + accountHolderName + '\'' +
                ", accountHolderNumber=" + accountHolderNumber +
                ", accountHolderAmount=" + accountHolderAmount +
                ", backAccountType=" + backAccountType +
                '}';
    }
}
