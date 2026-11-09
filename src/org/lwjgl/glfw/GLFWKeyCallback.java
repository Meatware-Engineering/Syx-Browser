package org.lwjgl.glfw;

public abstract class GLFWKeyCallback implements GLFWKeyCallbackI, AutoCloseable {
    protected GLFWKeyCallback() {}
    public void close() {}
}
