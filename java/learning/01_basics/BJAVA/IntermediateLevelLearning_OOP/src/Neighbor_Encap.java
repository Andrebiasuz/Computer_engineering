public class Neighbor_Encap {

    private String name ;
    private int age;
    private String street;

    // No Args
    public Neighbor_Encap() {
    }

    // All args
    public Neighbor_Encap(String name, int age, String street) {
        this.name = name;
        this.age = age;
        this.street = street;
    }

    // getters and setters

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getAge() {
        return age;
    }

    public void setAge(int age) {
        this.age = age;
    }

    public String getStreet() {
        return street;
    }

    public void setStreet(String street) {
        this.street = street;
    }
}
