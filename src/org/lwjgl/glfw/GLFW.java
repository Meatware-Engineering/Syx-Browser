package org.lwjgl.glfw;

import syx.browser.BrowserBridge;
import org.lwjgl.PointerBuffer;
import java.nio.IntBuffer;
import java.nio.DoubleBuffer;

public final class GLFW {
    private static GLFWErrorCallback errorCallback;
    private static int windowWidth, windowHeight;
    private static GLFWFramebufferSizeCallback framebufferCallback;
    private static GLFWKeyCallback keyCallback;
    private static GLFWCharCallback charCallback;
    private static GLFWMouseButtonCallback mouseCallback;
    private static GLFWScrollCallback scrollCallback;
    private static final boolean[] keys = new boolean[512];
    public static GLFWErrorCallback glfwSetErrorCallback(GLFWErrorCallbackI callback) {
        GLFWErrorCallback previous = errorCallback;
        errorCallback = (GLFWErrorCallback) callback;
        return previous;
    }
    public static boolean glfwInit() { return true; }
    public static void glfwDefaultWindowHints() {}
    public static void glfwWindowHint(int hint, int value) {}
    public static void glfwInitHint(int hint, int value) {}
    public static PointerBuffer glfwGetMonitors() { return new PointerBuffer(); }
    public static long glfwGetPrimaryMonitor() { return 1; }
    public static GLFWVidMode glfwGetVideoMode(long monitor) { return new GLFWVidMode(); }
    public static GLFWVidMode.Buffer glfwGetVideoModes(long monitor) { return new GLFWVidMode.Buffer(); }
    public static String glfwGetMonitorName(long monitor) { return "Browser"; }
    public static void glfwGetMonitorPos(long monitor, int[] x, int[] y) { x[0] = 0; y[0] = 0; }
    public static void glfwSetWindowPos(long window, int x, int y) {}
    public static long glfwGetWindowMonitor(long window) { return 0; }
    public static void glfwSwapInterval(int interval) {}
    public static boolean glfwExtensionSupported(CharSequence name) { return false; }
    public static String glfwGetVersionString() { return "Browser WebGL bridge"; }
    public static void glfwFocusWindow(long window) { BrowserBridge.focusCanvas(); }
    public static void glfwShowWindow(long window) { BrowserBridge.focusCanvas(); }
    public static GLFWKeyCallback glfwSetKeyCallback(long window, GLFWKeyCallbackI value) {
        GLFWKeyCallback previous = keyCallback; keyCallback = (GLFWKeyCallback) value;
        if (value != null) BrowserBridge.installInputHandler();
        return previous;
    }
    public static GLFWCharCallback glfwSetCharCallback(long window, GLFWCharCallbackI value) {
        GLFWCharCallback previous = charCallback; charCallback = (GLFWCharCallback) value; return previous;
    }
    public static GLFWMouseButtonCallback glfwSetMouseButtonCallback(long window, GLFWMouseButtonCallbackI value) {
        GLFWMouseButtonCallback previous = mouseCallback; mouseCallback = (GLFWMouseButtonCallback) value; return previous;
    }
    public static GLFWScrollCallback glfwSetScrollCallback(long window, GLFWScrollCallbackI value) {
        GLFWScrollCallback previous = scrollCallback; scrollCallback = (GLFWScrollCallback) value; return previous;
    }
    public static void keyEvent(int key, int action, int mods) {
        if (key >= 0 && key < keys.length) keys[key] = action != 0;
        if (keyCallback != null) keyCallback.invoke(1, key, 0, action, mods);
    }
    public static void charEvent(int codepoint) { if (charCallback != null) charCallback.invoke(1, codepoint); }
    public static void mouseEvent(int button, int action, int mods) { if (mouseCallback != null) mouseCallback.invoke(1, button, action, mods); }
    public static void scrollEvent(double x, double y) { if (scrollCallback != null) scrollCallback.invoke(1, x, y); }
    public static int glfwGetKey(long window, int key) { return key >= 0 && key < keys.length && keys[key] ? 1 : 0; }
    // shortcut: printable names use the US layout until browser keyboard layouts are mapped.
    public static String glfwGetKeyName(int key, int scancode) {
        return key >= 32 && key <= 96 ? String.valueOf(Character.toLowerCase((char) key)) : null;
    }
    public static void glfwGetCursorPos(long window, DoubleBuffer x, DoubleBuffer y) { x.put(0, BrowserBridge.cursorX()); y.put(0, BrowserBridge.cursorY()); }
    public static void glfwPollEvents() {
        BrowserBridge.pollEvents();
        int[] events = BrowserBridge.drainInput();
        for (int i = 0; i < events.length; i += 4) {
            switch (events[i]) {
                case 1 -> keyEvent(events[i + 1], events[i + 2], events[i + 3]);
                case 2 -> charEvent(events[i + 1]);
                case 3 -> mouseEvent(events[i + 1], events[i + 2], events[i + 3]);
                case 4 -> scrollEvent(events[i + 1], events[i + 2]);
                case 5 -> framebufferResized(events[i + 1], events[i + 2]);
                default -> throw new IllegalStateException("Unknown browser input event");
            }
        }
    }
    public static native void glfwSwapBuffers(long window);
    public static native int glfwGetWindowAttrib(long window, int attribute);
    public static boolean glfwWindowShouldClose(long window) { return false; }
    public static void glfwSetInputMode(long window, int mode, int value) {
        if (mode == 208897) BrowserBridge.setCursorVisible(value == 212993);
    }
    public static void glfwGetFramebufferSize(long window, IntBuffer width, IntBuffer height) {
        if (width != null) width.put(width.position(), windowWidth);
        if (height != null) height.put(height.position(), windowHeight);
    }
    public static void glfwGetWindowSize(long window, IntBuffer width, IntBuffer height) {
        glfwGetFramebufferSize(window, width, height);
    }
    public static GLFWFramebufferSizeCallback glfwSetFramebufferSizeCallback(long window, GLFWFramebufferSizeCallbackI callback) {
        GLFWFramebufferSizeCallback previous = framebufferCallback;
        framebufferCallback = callback == null ? null : new GLFWFramebufferSizeCallback(callback);
        if (callback != null) BrowserBridge.installResizeHandler();
        return previous;
    }
    public static void framebufferResized(int width, int height) {
        windowWidth = width;
        windowHeight = height;
        if (framebufferCallback != null) framebufferCallback.invoke(1, width, height);
    }
    public static long glfwCreateWindow(int width, int height, CharSequence title, long monitor, long share) {
        org.lwjgl.opengl.GL11.resetStencilCache();
        windowWidth = width;
        windowHeight = height;
        return BrowserBridge.createContext(width, height) ? 1 : 0;
    }
    public static void glfwMakeContextCurrent(long window) {}
    public static void glfwDestroyWindow(long window) { java.util.Arrays.fill(keys, false); org.lwjgl.opengl.GL11.resetStencilCache(); BrowserBridge.destroyContext(); }
    public static void glfwTerminate() { glfwDestroyWindow(1); }
}
