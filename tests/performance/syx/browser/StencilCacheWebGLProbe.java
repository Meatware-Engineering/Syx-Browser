package syx.browser;
import org.lwjgl.opengl.GL11;
import org.lwjgl.glfw.GLFW;
public final class StencilCacheWebGLProbe {
    private static native boolean state(int fail,int depthFail,int pass);
    private static native int calls();
    private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    public static void main(String[] args){
        check(GLFW.glfwCreateWindow(8,8,"synthetic",0,0)!=0,"context");
        int[] ops={0,5386,7680,7681,7682,7683,34055,34056};int cases=0;
        for(int a:ops)for(int b:ops)for(int c:ops){
            GL11.resetStencilCache();int before=calls();GL11.glStencilOp(a,b,c);GL11.glStencilOp(a,b,c);
            check(calls()==before+1,"duplicate not skipped");check(state(a,b,c),"front/back stencil state");check(GL11.glGetError()==0,"valid op GL error");cases++;
        }
        for(int i=0;i<3;i++){int[] invalid={7680,7680,7680};invalid[i]=999;
            for(int n=0;n<2;n++){int before=calls();GL11.glStencilOp(invalid[0],invalid[1],invalid[2]);check(calls()==before+1,"invalid skipped");check(GL11.glGetError()==1280,"invalid enum hidden");}}
        GL11.glStencilOp(7680,7680,7681);GLFW.glfwDestroyWindow(1);
        check(GLFW.glfwCreateWindow(8,8,"new synthetic",0,0)!=0,"new context");check(state(7680,7680,7680),"new context defaults");
        int before=calls();GL11.glStencilOp(7680,7680,7681);check(calls()==before+1&&state(7680,7680,7681),"stale cache after new window");
        check(GL11.glGetError()==0,"final GL error");GLFW.glfwTerminate();
        System.out.println("Stencil cache WebGL: "+cases+" valid triples, front/back readback, repeated invalid errors and new context: PASS");
    }
}
