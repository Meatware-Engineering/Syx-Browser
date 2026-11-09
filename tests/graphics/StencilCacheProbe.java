package org.lwjgl.opengl;
import org.lwjgl.glfw.GLFW;
public final class StencilCacheProbe {
    private static void expect(int count) {
        if (GL11.testOpCalls != count) throw new AssertionError("native calls " + GL11.testOpCalls + ", expected " + count);
    }
    public static void main(String[] args) {
        GLFW.glfwCreateWindow(8,8,"test",0,0);GL11.glStencilOp(7680,7680,7680);
        for(int i=0;i<10000;i++)GL11.glStencilOp(7680,7680,7680);expect(1);
        GL11.glStencilOp(0,7680,7680);GL11.glStencilOp(0,7681,7680);GL11.glStencilOp(0,7681,5386);expect(4);
        for(int position=0;position<3;position++){int[] values={0,7681,5386};values[position]=999;GL11.glStencilOp(values[0],values[1],values[2]);GL11.glStencilOp(values[0],values[1],values[2]);}expect(10);
        GL11.glStencilOp(0,7681,5386);expect(10);
        GLFW.glfwDestroyWindow(1);GL11.glStencilOp(0,7681,5386);expect(11);
        GLFW.glfwCreateWindow(8,8,"new",0,0);GL11.glStencilOp(0,7681,5386);expect(12);
        int[] ops={0,5386,7680,7681,7682,7683,34055,34056};
        for(int a:ops)for(int b:ops)for(int c:ops){GL11.resetStencilCache();int before=GL11.testOpCalls;GL11.glStencilOp(a,b,c);GL11.glStencilOp(a,b,c);if(GL11.testOpCalls!=before+1)throw new AssertionError("op");}
        GL11.resetStencilCache();GL11.testFailNext=true;int before=GL11.testOpCalls;
        try{GL11.glStencilOp(7680,7680,7680);throw new AssertionError("expected failure");}catch(IllegalStateException expected){}
        GL11.glStencilOp(7680,7680,7680);if(GL11.testOpCalls!=before+2)throw new AssertionError("failed call cached");
        GLFW.glfwTerminate();System.out.println("Stencil op cache: repeats, all parameters, 512 op triples, invalid enums, failures and window lifecycle: PASS");
    }
}
