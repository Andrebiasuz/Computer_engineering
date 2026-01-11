public class Wanaba extends Neighbor_Abs {

    public void professionEngineer_deprecated()
    {
        System.out.println("I am " + name +  " and I will study engineering and nothing else!");
    }

    // using polymorphism to write profession method

    @Override
    public void profession()
    {
        System.out.println("I am " + name +  " and I will study engineering and nothing else!, because I am a Wanaba");
    }

    @Override
    public String toString() {
        return "Wanaba{" +
                "name='" + name + '\'' +
                ", age=" + age +
                ", street='" + street + '\'' +
                ", yearsAsNeighbor=" + yearsAsNeighbor +
                ", neighborRank=" + neighborRank +
                '}';
    }
}
