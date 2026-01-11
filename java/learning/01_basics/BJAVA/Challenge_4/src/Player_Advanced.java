public class Player_Advanced extends Player_Basic{

    String speciality;

    public Player_Advanced(String name, int age, String position, String speciality) {
        // super takes items from parent class to create a new constructor.
        super(name, age, position);
        this.speciality = speciality;
    }

    public Player_Advanced(String speciality) {

    }

    @Override
    public void showInfo()
    {
        System.out.println("Name: " + name + " Age: " + age + " Position: " + position + " Specialty : " + speciality + ".");

    }

}
