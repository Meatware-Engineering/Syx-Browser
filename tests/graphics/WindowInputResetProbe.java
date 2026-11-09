import org.lwjgl.glfw.GLFW;
public final class WindowInputResetProbe {
    private static void expect(int key, int action) {
        if (GLFW.glfwGetKey(1, key) != action) throw new AssertionError("Wrong key state: " + key + " expected " + action);
    }
    public static void main(String[] args) {
        GLFW.glfwCreateWindow(100, 100, "test", 0, 0);
        GLFW.keyEvent(87, 1, 0); GLFW.keyEvent(340, 1, 1);
        expect(87, 1); expect(340, 1);
        GLFW.glfwDestroyWindow(1);
        expect(87, 0); expect(340, 0);
        GLFW.glfwCreateWindow(100, 100, "new", 0, 0);
        expect(87, 0); GLFW.keyEvent(65, 1, 0); expect(65, 1);
        GLFW.glfwTerminate(); expect(65, 0);
        GLFW.glfwTerminate(); expect(65, 0);
        System.out.println("Window input reset on destroy/terminate: PASS");
    }
}
