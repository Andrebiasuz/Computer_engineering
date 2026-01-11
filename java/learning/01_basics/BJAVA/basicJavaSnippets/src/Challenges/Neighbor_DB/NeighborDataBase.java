package Challenges

import java.util.Scanner;

//  You were assigned a task to create a database to store Neighbors Names in a street.
// This is a menu base system , so create the Menu structure as well.

public class Neighbor_DB {
    public static void main(String[] args) {

        String[] neighbors = new String[10]; // declare array.
        int array_idx = 0;
        int modify_key;
        int menu_key;

        System.out.println("Welcome to the neighbor database system for our street");

        while(true) {
            System.out.print(System.lineSeparator());
            System.out.println("Menu:");
            System.out.println("1 - Enter new neighbor.");
            System.out.println("2 - Delete neighbor. **** NOT IMPLEMENTED***");
            System.out.println("3 - Show list of neighbors.");
            System.out.println("4 - Modify neighbor entry");
            System.out.println("5 - Exit Program");
            System.out.println("");
            System.out.print("Select: ");

            // SCANNER INIT
            Scanner scanner = new Scanner(System.in);
            menu_key = scanner.nextInt();
            scanner.nextLine();

            // CREATE MENU
            switch (menu_key) {
                case 1:
                    System.out.print("Name: ");
                    String name = scanner.nextLine();

                    if (neighbors[array_idx] == null) {
                        neighbors[array_idx] = name;
                        array_idx = array_idx + 1;
                    }
                    break;

                case 2:
                    System.out.println("This feature is not available, just modify the new neighbor in one you desire to delete");
                    break;

                case 3:
                    for (int i = 0; i < 10; i++) {
                        if (!(neighbors[i] == null)) {
                            System.out.println("Neighbor " + (i + 1) + ": " + neighbors[i] + ".");
                        }
                    }
                    System.out.println();
                    break;

                case 4:

                    while (true) {
                        System.out.print("Which entry would you like to modify?");
                        modify_key = scanner.nextInt();
                        scanner.nextLine();

                        if (neighbors[modify_key - 1] == null) {
                            System.out.println("There is nothing on this space. Please select another index: ");
                        } else {
                            break;
                        }
                    }

                    System.out.print("Name: ");
                    String name_modify = scanner.nextLine();

                    if (!(neighbors[modify_key - 1] == null)) {
                        neighbors[modify_key - 1] = name_modify;
                    }
                    break;

                case 5:
                    System.exit(0);
                default:
                    System.out.println("Try again with a valid answer");
            }
        }
    }
}
