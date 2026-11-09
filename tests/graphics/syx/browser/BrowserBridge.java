package syx.browser;
// JVM-only window/input fake: no browser or native graphics/audio calls.
public final class BrowserBridge {
    public static String getString(int name) { return "test"; }
    public static boolean createContext(int width, int height) { return true; }
    public static void destroyContext() {}
    public static void focusCanvas() {}
    public static void installInputHandler() {}
    public static void installResizeHandler() {}
    public static void setCursorVisible(boolean visible) {}
    public static double cursorX() { return 0; }
    public static double cursorY() { return 0; }
    public static void pollEvents() {}
    public static int[] drainInput() { return new int[0]; }
}
