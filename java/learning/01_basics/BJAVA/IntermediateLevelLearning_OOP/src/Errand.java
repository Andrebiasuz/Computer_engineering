public class Errand {

    private String description;
    ErrandRank errandRank;

    public Errand(String description, ErrandRank errandRank) {
        this.description = description;
        this.errandRank = errandRank;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void showDescription(){
        System.out.println("Errand description: " + getDescription() + ". Errand Rank: " + errandRank + ".");
        System.out.println();
    }

    @Override
    public String toString() {
        return "Errand{" +
                "description='" + description + '\'' +
                ", errandRank=" + errandRank +
                '}';
    }
}
