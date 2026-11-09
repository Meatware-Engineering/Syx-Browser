package org.lwjgl.glfw;

public final class Callbacks {
    private Callbacks() {}
    public static void glfwFreeCallbacks(long window) {
        GLFW.glfwSetFramebufferSizeCallback(window, null);
        GLFW.glfwSetKeyCallback(window, null);
        GLFW.glfwSetCharCallback(window, null);
        GLFW.glfwSetMouseButtonCallback(window, null);
        GLFW.glfwSetScrollCallback(window, null);
    }
}
