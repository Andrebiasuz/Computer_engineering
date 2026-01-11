public class Bank {

    public static void main(String[] args) {

        double standardTariff = 1; // 1%

        SavingsAccount A_00001 = new SavingsAccount("Andre Biasuz" , "000001-1", 0.0 , AccountTypes.SAVINGS_ACCOUNT );
        CheckingAccount A_00002 = new CheckingAccount("André Biasuz" , "000001-0", 0.0 , AccountTypes.CHECKING_ACCOUNT);

        System.out.println();
        A_00001.moneyDeposit(5000);
        A_00001.viewAccountBalance();
        System.out.println();

        System.out.println();
        A_00002.moneyDeposit(5000 , standardTariff);
        A_00002.viewAccountBalance();
        System.out.println();

        System.out.println();
        A_00001.accountTransfer(A_00001, A_00002, 1000);

        A_00001.viewAccountBalance();
        A_00002.viewAccountBalance();
    }
}
