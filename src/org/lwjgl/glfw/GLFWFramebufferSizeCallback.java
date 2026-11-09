package org.lwjgl.glfw;

public final class GLFWFramebufferSizeCallback implements GLFWFramebufferSizeCallbackI {
    private final GLFWFramebufferSizeCallbackI delegate;
    public GLFWFramebufferSizeCallback(GLFWFramebufferSizeCallbackI delegate) { this.delegate = delegate; }
    public void invoke(long window, int width, int height) { delegate.invoke(window, width, height); }
}
