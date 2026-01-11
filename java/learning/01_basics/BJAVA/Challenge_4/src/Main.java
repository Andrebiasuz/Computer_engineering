public class Main {

    public static void main(String[] args) {

        Player_Basic Laylo = new Player_Basic("Laylo", 28, "Striker");
        Player_Advanced Andre = new Player_Advanced("Andre",35, "Forward" , "Good finish");

        System.out.println();
        Laylo.showInfo();
        Andre.showInfo();

        System.out.println();
        Andre.showSkill(eSkillType.CAPTAIN);
        Laylo.showSkill(eSkillType.HUSTLER);
    }
}
