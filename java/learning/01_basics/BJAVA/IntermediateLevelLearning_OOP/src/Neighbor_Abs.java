public abstract class Neighbor_Abs
{
    // don't use pvsm

    // what do we need to build this mold?
    // name , age, street
    String name ;
    int age;
    String street;

    // attributes created later.
    int yearsAsNeighbor;
    NeighborRank neighborRank;

    // constructors

    // noArgs
    public Neighbor_Abs() {
    }

    // allArgs
    public Neighbor_Abs(String name, int age, String street) {
        this.name = name;
        this.age = age;
        this.street = street;
    }

    // allArgs with attributes that came later (Constructor Overload)
    public Neighbor_Abs(String name, int age, String street, int yearsAsNeighbor, NeighborRank neighborRank) {
        this(name, age, street); // constructor overload.
        this.yearsAsNeighbor = yearsAsNeighbor;
        this.neighborRank = neighborRank;
    }

    // Create a public method (everybody can access)
    // Creating a void method, it will not return anything.
    public void hadAFit()
    {
        System.out.println("I had enough with this neighborhood, I am going mad. I will break something");
    }
    // Why parenthesis at the end? So Java knows this is a method.

    // Creating same method but as void and return

    public void briefIntroduction_Void()
    {
        System.out.println("Hello! My name is " + name + ". I live at " + street + ", and my age is " + age + ".");
    }

    public String briefIntroduction_String()
    {
        return ("Hello! My name is " + name + ". I live at " + street + ", and my age is " + age + ".");
    }

    public int yearsToBeNeighborBS(int minimalAgeToAchieveBigShot) {
        return minimalAgeToAchieveBigShot - age;
    }

    public void needToStudyEngineeringDeprecated()
    {
        System.out.println("I am " + name +  " and I will study engineering and nothing else!");
    }

    public void showBasicData()
    {
        System.out.println("Name: " + name + ".");
        System.out.println("Age: " + age + ".");
        System.out.println("Street: " + street + ".");
    }

    // showing method overload
    public void showBasicData(int IQ)
    {
        System.out.println("Name: " + name + ".");
        System.out.println("Age: " + age + ".");
        System.out.println("Street: " + street + ".");
        if (IQ >= 150)
        {
            System.out.println("Jesus my IQ is " + IQ + "! I am so smart I should be neighbor big shot without waiting for all those years. ");
        }
    }

    // Example for polymorphism

    public void profession()
    {
        System.out.println("My name is " + name + " and my profession depends on my tribe");
    }

    @Override
    public String toString() {
        return "Neighbor_Abs{" +
                "name='" + name + '\'' +
                ", age=" + age +
                ", street='" + street + '\'' +
                ", yearsAsNeighbor=" + yearsAsNeighbor +
                ", neighborRank=" + neighborRank +
                '}';
    }
}
