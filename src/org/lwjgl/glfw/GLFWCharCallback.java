package org.lwjgl.glfw;

public abstract class GLFWCharCallback implements GLFWCharCallbackI, AutoCloseable {
    protected GLFWCharCallback() {}
    public void close() {}
}
