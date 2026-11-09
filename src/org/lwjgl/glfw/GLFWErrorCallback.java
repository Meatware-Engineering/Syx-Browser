package org.lwjgl.glfw;

import java.io.PrintStream;

public class GLFWErrorCallback implements GLFWErrorCallbackI {
    private final PrintStream stream;
    private GLFWErrorCallback(PrintStream stream) { this.stream = stream; }
    public static GLFWErrorCallback createPrint(PrintStream stream) { return new GLFWErrorCallback(stream); }
    public GLFWErrorCallback set() { GLFW.glfwSetErrorCallback(this); return this; }
    public void free() {}
    public void invoke(int error, long description) { stream.println("GLFW error: " + error); }
}
