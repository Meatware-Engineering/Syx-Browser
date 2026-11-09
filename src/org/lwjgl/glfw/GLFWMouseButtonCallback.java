package org.lwjgl.glfw;

public abstract class GLFWMouseButtonCallback implements GLFWMouseButtonCallbackI, AutoCloseable {
    protected GLFWMouseButtonCallback() {}
    public void close() {}
}
