package syx.browser;

import org.lwjgl.glfw.Callbacks;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWKeyCallback;

public final class GraphicsCleanupProbe {
    private static native void complete();
    public static void main(String[] args) {
        long window = GLFW.glfwCreateWindow(100, 100, "Test", 0, 0);
        if (window == 0) throw new AssertionError("WebGL unavailable");
        GLFW.glfwSetKeyCallback(window, new GLFWKeyCallback() {
            public void invoke(long w, int key, int scancode, int action, int mods) {}
        });
        Callbacks.glfwFreeCallbacks(window);
        if (GLFW.glfwSetKeyCallback(window, null) != null) throw new AssertionError("Key callback retained");
        GLFW.keyEvent(87, 1, 0);
        if (GLFW.glfwGetKey(window, 87) != 1) throw new AssertionError("Key press not recorded");
        GLFW.glfwDestroyWindow(window);
        if (GLFW.glfwGetKey(window, 87) != 0) throw new AssertionError("Held key survived window destruction");
        GLFW.glfwTerminate();
        complete();
        System.out.println("Graphics cleanup: PASS");
    }
}
