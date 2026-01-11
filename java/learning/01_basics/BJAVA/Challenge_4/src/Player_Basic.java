public class Player_Basic implements iFootballPlayer {

    String name;
    int age;
    String position;

    // aLL args constructor
    public Player_Basic(String name, int age, String position) {
        this.name = name;
        this.age = age;
        this.position = position;
    }

    // no ars constructor
    public Player_Basic() {
    }

    public void showInfo()
    {
        System.out.println("Name: " + name + " Age: " + age + " Position: " + position + ".");
    }

    // method receiving enum
    public void showSkill(eSkillType skill )
    {
        System.out.println("The main skill of " + name + " is to be a " + skill + " type of player");
    }
}
