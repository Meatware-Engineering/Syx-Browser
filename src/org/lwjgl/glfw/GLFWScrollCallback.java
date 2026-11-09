package org.lwjgl.glfw;

public abstract class GLFWScrollCallback implements GLFWScrollCallbackI, AutoCloseable {
    protected GLFWScrollCallback() {}
    public void close() {}
}
