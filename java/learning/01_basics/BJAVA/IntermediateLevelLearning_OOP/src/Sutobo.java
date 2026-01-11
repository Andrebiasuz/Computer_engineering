public class Sutobo extends  Neighbor_Abs
{

    public Sutobo() {
    }

    public Sutobo(String name, int age, String street) {
        super(name, age, street);
    }

    public Sutobo(String name, int age, String street, int yearsAsNeighbor, NeighborRank neighborRank) {
        super(name, age, street, yearsAsNeighbor, neighborRank);
    }

    public void professionPM_deprecated()
    {
        System.out.println("My name is " + name + " and I will be a PM!");
    }

    @Override
    public void profession()
    {
        System.out.println("My name is " + name + " and I will be a PM, because I am a Sutobo!");
    }

    @Override
    public void showBasicData()
    {
        System.out.println("Name: " + name + ".");
        System.out.println("Age: " + age + ".");
        System.out.println("Street: " + street + ".");
        System.out.println("I am a buckling' proud Sutobo! Yeah!");
    }

    @Override
    public String toString() {
        return "Sutobo{" +
                "name='" + name + '\'' +
                ", age=" + age +
                ", street='" + street + '\'' +
                ", yearsAsNeighbor=" + yearsAsNeighbor +
                ", neighborRank=" + neighborRank +
                '}';
    }
}
