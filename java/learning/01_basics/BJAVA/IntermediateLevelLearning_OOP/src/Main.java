public class Main {
    public static void main(String[] args) {

        // create Neighbor
        String neighbor_name = "Andre";
        int neighbor_age = 36;
        String neighbor_street = "Alameda das Lamentações";

        // How to create another neighbor?
        // We would have to do it all again.
        // We do not want that

        // So we use objects

        // How objects are made?

        // Everything in life comes from molds, or standards.
        // Bottles comes from bottles molds, etc


        // Molds in programming are called classes

        // So lets build a class for neighbor, a mold for neighbor
        // This will be another class so watch for the folder

        // with the class created, add another neighbor

        // when we initialize an object, we need to call the class that the object will be based upon
        Neighbor Alexandra = new Neighbor();

        // now that we initialized it, we can access the attributes we put on the class (name, age, street)

        Alexandra.name = "Alexandra";
        Alexandra.age = 35;
        Alexandra.street = "São Paulo";

        // So lets make create Andre but using the same mold, the same class.

        Neighbor Andre  = new Neighbor();

        Andre.name = "Andre";
        Andre.age = 36 ;
        Andre.street = "Alameda das Lamentações";

        // Now we can create unlimited objects , with the same molds.

        // METHODS AND PARAMETERS

        // Methods are basically actions that we can do with the objects and its parameters
        // Ex: We can get Andre.name and add a method called toUpper to capitalize the name.
        // It would be Andre.name.toUpper()
        // Lets add a method in the class

        // we create a method so people can express themselves :)
        System.out.println("Andre is pissed and it is expressing himself with a void method:");
        Andre.hadAFit();

        System.out.println();
        // Let's create a method that actually returns something, this is better practice
        // At the same time, we create a method that acts the same but does not return anything
        System.out.println("Using return method");
        String modelOfGoodCitizenIntroduction = Andre.briefIntroduction_String();
        System.out.println(modelOfGoodCitizenIntroduction);

        System.out.println("Using void method");
        Andre.briefIntroduction_Void();

        // Ok, introduction made. But Andre is ambitious, Andre wants to know how many year he has left
        // to be Neighbor Big Shot, or of course Neighbor BS (pun intended), a distinction amongst neighbors.

        // For that we need parameters, basically it is value that will be passed to the class from the object.
        // We will create this in the Neighbor class.
        // We are assuming that the neighbor is a young gun, and it is not fit for Neighbor BS just yet
        System.out.println();
        System.out.println("Using parameters:");
        System.out.println("Andre wants to know how many years until Neighbor BS, but we have to decide ");
        System.out.println("the minimal age for it");

        int andreYearsRemainingForBS = Andre.yearsToBeNeighborBS(50);
        System.out.println("Poor Andre still has to live " + andreYearsRemainingForBS + " years to achieve BS level");


        // PILLARS OF OBJECT ORIENTED PROGRAMMING

        // INHERITANCE
        // Using characteristics of a mother class in a child class to save code and make it agile
        // Ex:  mother class Animal will serve as model (class) for Classes cat, dog, beaver, Monkey, etc.
        // It will INHERIT the mold and its objects, like walking, eating, etc. Things that are COMMON to all
        // animals, or common to all instances of that mother class.

        // POLYMORPHISM

        // To create a unique function that can be utilized by different classes with different characteristics,
        // basically the reducer of IFs statements, according to Dedé
        // https://www.youtube.com/watch?v=Lf3ZV0UsnEo
        // Yeah, I didn't understand and neither did you so, lets put some code into it.

       /*
        public class StreetPlaza {
            public static void main(String[] args) {
                Neighbor Andre = new MaleNeighbor("Andre");
                Neighbor Alexandra = new FemaleNeighbor("Alexandra");

                converse(Andre);  // Output: Andre talks like a man, low pitch voice.
                converse(Alexandra); // Output: Alexandra talks with a slightly high pitch voice.
            }

            public static void converse(Neighbor neighbor) {
                neighbor.talk(); // talk method is called in a polymorphic way
            }
        }*/

        // ENCAPSULATION

        // Basically prevents that any unwanted interaction between the object and the outside world is done.
        // In this way, the object can be encapsulated and used many times without interfering with other code
        // Think about a bottle of beer that doesn't spill on your table. It is not affecting anything, just
        // doing its job. The drink is encapsulated inside the bottle.

        // DEEP DIVE IN INHERITANCE

        // let's create a method in the Neighbor class that says that Andre wants to study engineering.
        // Its deprecated because, well, you will understand later.
        System.out.println();
        System.out.println("Andre showing his crazy intent for engineering but without inheritance");
        Andre.needToStudyEngineeringDeprecated();

        // but wait. In this way, everybody can study engineering.
        // Because this method is in the Neighbor superclass or mother class.
        // There is something I have not told you. We live in an alternative universe
        // People are divided into tribes.
        // Andre is from the Wanaba tribe
        // Alexandra is from the Sutobo tribe
        // Wanabas have an aptitude for engineering. Actually only they can study engineering.
        // Sutobos can not be engineers, but they can be PMs
        // so using this action above (this method) in Alexandra is completely useless. She wants to be a PM.

        // So in this case it makes way more sense to create Wanaba and Sutobo classes.
        // But these people are still neighbors, they'll still have name, age and street. So why write these properties
        // twice if we can use inheritance and create a super class Neighbor? Actually we already have it, how great.
        // we will create 2 more class files.
        // we created male  Wanaba and Sutobo classes., they INHERIT traits from Neighbor.

        // we will create another Andre and Alexandra using these dystopian classes.
        // so the D is for dystopian.

        System.out.println();
        System.out.println("Using inheritance the right way");

        Wanaba AndreD = new Wanaba();
        Sutobo AlexandraD = new Sutobo();

        AndreD.name = "Andre";
        AndreD.age = 36;
        AndreD.street = "Alameda das Lamentações";

        AlexandraD.name = "Alexandra";
        AlexandraD.age = 35;
        AlexandraD.street = "São Paulo";

        AndreD.professionEngineer_deprecated();
        AlexandraD.professionPM_deprecated();

        // to make the infos better documented, lets create a method to show each Neighbor basic infos.
        // Sutobos like to boast. So in the Sutobo subclass write in capitals that people in that class are sutobos
        System.out.println();
        System.out.println("Wanaba quietly showing data");
        AndreD.showBasicData();

        System.out.println();

        System.out.println("Sutobo loudly showing data");
        AlexandraD.showBasicData();


        // INTERFACES

        // Okay, but what about if Andre and Alexandra have a baby?
        // There is nothing preventing that in our universe. The kid can be an engineer and also a PM, right?
        // How to do that in OOP? We use interfaces.

        // If classes are molds, interfaces are windows to methods of different classes.
        // We will create an interface for this kid.
        // The Kid name is Juliana, and she is cute
        // She has the power to be an engineer from her dad, and she has mixed her mothers PM duty with her fathers engineering prowess to become a PO.

        WanabaSutobo Juliana = new WanabaSutobo();

        Juliana.name = "Juliana";
        Juliana.age = 17;
        Juliana.street = "Alameda das Lamentações";

        System.out.println();
        System.out.println("Juliana has grown strong and want to give her personal details and her profession as PO");
        Juliana.showBasicData();
        Juliana.professionPO_deprecated();

        // Also lets highlight that Alexandra has moved to Alameda with her family

        AlexandraD.street = AndreD.street;

        System.out.println();
        AlexandraD.showBasicData();

        // POLYMORPHISM

        // Methods and classes can morph and assume different behaviours.
        // An example, in our universe, every different tribe has its own profession.
        // Wanaba is Engineer, Sutobo is PM, and so on.
        // RN, we are creating every single profession method inside each tribe class
        // Sutobo has professionPM_deprecated(), Wanaba has professionEngineer_deprecated()
        // This is too much code, bc then every different trible we create will have a method like this.
        // we can use polymorphism for that, by creating a method called profession in the Neighbor SuperClass.

        // Showing profession statements using polymorphism

        System.out.println();
        AndreD.profession(); // prints engineer

        System.out.println();
        AlexandraD.profession(); // Prints PM

        System.out.println();
        Juliana.profession(); // prints PO


        // CONSTRUCTORS

        // Refer to challenge 4 to check about constructors. They are basically molds to initialize molds,
        // or a set of parameters to instantiate objects

        // ABSTRACT CLASSES

        // we are talking much about class mother and father, etc But there is a way to make these classes "steril".
        // in this way, the Mother Class Neighbor will not have kids, but she will be used as a mold for other classes.
        // Now the tribal classes instantiate the objects, and the Neighbor class is standard of which these classes are created

        // we will create NeighborAbs to indicate that it is abstract
        // we will also make the tribal classes inherit from this abstract class
        // we can also have abstract methods, which dont have any actions in the abstract class, only in the classes
        // they are instantiated .
        //
        // For this, we have the profession() method as an example, but we wont use it since
        // it is already an example of interface use.

        // what is common between abstract classes and interfaces?
        //      They can only declare abstract objects, not arguments.
        //      They cannot instantiate objects.

        // why using abstract classes at all if they dont instantiate anything?
        //      Because in this case, we do not want to create any object from the class Neighbor. We only use it
        //      as template. And we want to force the user to create objects the right way, since here everybody
        //      will have its own tribe. So we create objects straight from the tribes, using the Neighbor template


        //   Main Concepts about Superclasses and Subclasses
        //
        //    Superclass: The generic class from which other classes inherit. It contains attributes and
        //    methods common to all subclasses. In the example above, Neighbor  is the superclass.
        //    Subclass: A class derived from a superclass. The subclass inherits attributes and methods from
        //    the superclass, but can add its own or modify (overwrite) existing ones.
        //    In the example, Sutobo  and Wanaba are subclasses of Neighbor.
        //    Inheritance: This is the mechanism that allows a subclass to inherit characteristics from a superclass.
        //    In the example, both Sutobo and Wanaba inherit Neighbor's showBasicData() method.
        //    Method overwriting: When a subclass provides a specific implementation for a method that
        //    is already defined in its superclass.
        //    In the example, profession() is overwritten in the Sutobo and Wanaba subclasses.

        //  Main Concepts about Interfaces
        //
        //     Concept: An interface is like a contract that contains abstract method declarations
        //    and constants. Any class that implements an interface must provide the implementation of the
        //    methods defined by it.
        //    Separation of Responsibilities: Interfaces help separate the “what to do” (defined by the interface)
        //    from the “how to do it” (implemented by the classes), promoting a cleaner and more modular design.
        //    Multiple Inheritance: In Java, a class can only inherit from a single class,
        //    but it can implement several interfaces.
        //    This allows you to create varied behaviors without the limitations of single inheritance.
        //    Flexibility and Polymorphism: Using interfaces allows different classes to implement
        //    the same contract, facilitating the use of polymorphism when working with
        //    methods that accept objects of different types.
        //    Example in the Context of Neighbors :
        //    Imagine a Neighbor interface with methods such as Welcome(), Walk() and Shout().
        //    Classes like Andre and Alexandra could implement this interface and provide specific behaviors
        //    for these methods, while the code that consumes the interface treats both objects uniformly.

        // CONSTRUCTOR OVERLOAD

        // We need to add two attributes to our neighbor, yearsAsNeighbor and NeighborRank.
        // Neighbor ranks are Casual, Reliable, Guardian, and Grand.
        // Ranks are fixed, so let's create an enum.
        // ENUM created, so we need to change the main neighbor superclass to put these values.

        // Constructor created in the super class. A constructor with the values originally created(name,age,street)
        // and another one with the values that came after.
        // This is important because, if we created objects with the OLD constructor and after decide to change that
        // Constructor, we would have to change the old code.
        // This is not scalable
        // In this way, we overload the original constructor, adding new features.
        // Now we can initialize Neighbor using both constructor. Using what is best for the moment.

        Sutobo Tomas = new Sutobo("Tomas", 30 , "Rua do Reticulo", 5, NeighborRank.GRAND);

        System.out.println();
        Tomas.showBasicData();

        // NEXT METHOD OVERLOAD, WE WILL OVERLOAD THE showBasicData()


        //     Method overloading: This is the process of defining more than one method with the same name in a class,
        //     but with different signatures. Method signatures differ by the number of parameters,
        //     the type of the parameters, or the order of the parameters.
        //    Method signature: The signature of a method includes its name and the list of parameters.
        //    Overloading requires that each overloaded method has a unique signature, which allows the
        //    compiler to distinguish between methods.
        //    Flexibility and Reuse: Method overloading allows you to reuse the method name to perform similar operations,
        //    but adapted to different types of input. For example, you could have a method for calculating damage in a fight with different types of attacks, such as a physical attack or a jutsu attack.
        //    Example in the Context of Neighbor: Imagine a shout() method that can be overloaded to accept different
        //    parameters: one that performs a standard shout and another that performs a shout based on
        //    how angry the person is. This way, you can use the same method name for different  scenarios.
        //    Limitations: Method overloading is based only on the method signature (name and parameters).
        //    The return type alone cannot be used to differentiate overloaded methods.

        // Tomas is very smart. He wants to show his IQ in Basic Data.
        System.out.println();
        System.out.println("Basic data with IQ showing");
        Tomas.showBasicData(190);

        // USE OF THE OVERRIDE ANNOTATION
         //
        //    Concept of @Override: The @Override annotation is used to mark a method in a subclass that is
        //    overriding a method in the superclass. This clearly indicates the intention to override an
        //    existing method in the superclass.
        //    Compilation error: Although not mandatory, using @Override helps the compiler check
        //    whether the subclass method is actually overriding a superclass method.
        //    If the superclass method is changed or removed, the compiler will generate an error if the
        //    subclass method is annotated with @Override and does not match the signature of the method
        //    in the superclass.
        //    Improved readability: The @Override annotation improves the clarity of the code by making it clear
        //    that the method is overriding a method in the superclass. This makes the code easier to understand,
        //    especially in complex class hierarchies.
        //    Convention and Practice: Although the use of @Override is not mandatory,
        //    it is a widely accepted and recommended practice that helps to avoid subtle errors and facilitates code maintenance.
        //    Example in the Context of Naruto: Imagine a Ninja class with a method shout() and subclasses such as
        //    Wanaba and Sutobo that override this method. Using @Override on subclasses helps ensure
        //    that the overridden method corresponds to the method defined in the superclass.

        // REFERENCE IN MEMORY x VALUE IN MEMORY
        System.out.println();

        System.out.println("Reference in memory");
        //System.out.println(AlexandraD); // prints Sutobo@6e2c634b , this is the space allocated in memory
        //System.out.println(AlexandraD.name); // prints value stored in the memory (name Alexandra), this is value in memory

        // what is toString method is going to do?

        //toString , as auto generated by IntellJ, will provide me documentation of attributes  tied to the class.
        System.out.println();
        System.out.println("Printing object with toString");
        System.out.println(AlexandraD.toString());

        //
        //Final method: A method declared with the final keyword cannot be overwritten by subclasses.
        // This is useful when you want to ensure that the implementation of a method remains unchanged
        // in derived classes.
        //Final Class: A class that is marked as final cannot be extended.
        // This prevents other classes from inheriting from a final class, ensuring that its functionality is preserved without modification.
        // Common Use: Final methods and classes are often used in situations where the security,
        // integrity or expected behavior of a class needs to be guaranteed, such as in frameworks or libraries.
        // Benefits of Final Methods: The use of final methods can improve performance,
        // as the compiler can optimize calls to these methods with the certainty that
        // they won't be changed in subclasses. It also helps to avoid accidental overwriting errors.


        //    Final Class: A class declared with the final keyword cannot be extended by other classes.
        //    This means that no subclasses can be created from it, ensuring that its implementation
        //    remains immutable.
        //    Reason for Use: Final classes are often used when you want to ensure that the logic or
        //    behavior of the class is not altered by inheritance, especially in sensitive APIs or
        //    libraries where changes could compromise integrity.
        //    Example: The String class in Java is final. This prevents other classes from changing
        //    the way strings are handled, maintaining the security and consistency of the language.
        //    Benefits of Final Classes: They help improve security and performance,
        //    since the compiler can perform optimizations knowing that the class will not be
        //    modified. In addition, problems related to inheritance are avoided, such as the
        //    accidental overwriting of important methods.


        // ENCAPSULATION

        // Main concepts about encapsulation

        //Concept of Encapsulation: This consists of protecting the attributes of a class,
        // allowing them to be accessed or modified only through public methods.
        // This prevents direct and uncontrolled access to an object's data.
        // Attribute privacy: The attributes of a class are declared as private,
        // which means that they cannot be accessed directly by other classes.
        // Instead, we use public methods called getters and setters.
        // Security and Control: Encapsulation allows you to control how the internal data of a class
        // is modified by implementing validations within the setter methods.
        // This protects the integrity of the data.
        //Better Organization: The use of encapsulation improves the organization and maintenance of code,
        // separating responsibilities for accessing and modifying attributes and facilitating the
        // evolution of the system.
        // Example in the context of Neighbor: Imagine a NeighborAndre class with attributes such as name,
        // age and tribe. These attributes would be private and could only be accessed or modified
        // through public methods, guaranteeing the protection of the character's information.


        //Getters and Setters - A more technical explanation
        //
        //Getters and Setters are special methods used to access and modify the private attributes of a class in Java.
        // They are part of the concept of encapsulation, allowing the internal data of a class to be
        // protected and accessed in a controlled manner.
        //Main concepts about Getters and Setters
        //
        // Getters: These are public methods used to access the values of the private attributes of a class.
        // They allow other objects to "read" the value of an attribute, but without directly modifying the data.
        //
        // Setters: These are public methods used to modify the values of a class's private attributes.
        // They allow the value of an attribute to be changed in a controlled way, and can include validations.
        //
        // Encapsulation: Private attributes cannot be accessed directly by other classes.
        // The getters and setters methods ensure that information is manipulated in a safe and controlled manner,
        // respecting encapsulation.
        //
        // Validations: Setters methods can include checks and validations before modifying attribute values,
        // guaranteeing data integrity.
        // Example in the context of the code: Imagine a Neighbor class with the age attribute.
        // The getter method for age will allow other classes to "read" the character's age,
        // while the setter will allow the age to be changed,
        // perhaps with a validation that prevents negative values.
        //

        // TASK CREATE NEIGHBOR SUPER CLASS USING ENCAPSULATION

        // created as Neighbor_Encap

        // ENUMS

        // TASK: CREATE A CLASS CALLED NEIGHBOR ERRANDS AND AN ENUM WITH A SET OF DIFFICULTIES.

        Errand Errand1 = new Errand("Go to the mall and get me a soda", ErrandRank.C);
        System.out.println();
        Errand1.showDescription();

        // PRINT WITH TOSTRING
        System.out.println(Errand1.toString());

    }

}

