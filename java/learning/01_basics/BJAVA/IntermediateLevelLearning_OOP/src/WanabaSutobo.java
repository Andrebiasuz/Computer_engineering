
// Wanaba Sutobo kid inherits engineering powers and accesses window to other methods
public class WanabaSutobo extends Wanaba implements iWanabaSutobo
{
    public void professionPO_deprecated()
    {
        System.out.println("I am " + name + " and I am a Product Owner. I am a mixed tribe and that is giving me super powers!");
    }

    @Override
    public void profession()
    {
        System.out.println("I am " + name + " and I am a Product Owner. I am a mixed tribe and that is giving me super powers!");
    }
}
