public enum ErrandRank {

    A("Very hard", 45),
    B("Hard", 30),
    C("Comfortable", 20),
    D("Calm", 15),
    E("Easy", 10),
    ;

    private String description;
    private int errandPoints;

    ErrandRank(String description, int errandPoints) {
        this.description = description;
        this.errandPoints = errandPoints;
    }
}
