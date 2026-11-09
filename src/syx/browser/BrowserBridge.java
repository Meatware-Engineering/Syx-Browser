package syx.browser;

public final class BrowserBridge {
    public static native boolean createContext(int width, int height);
    public static native void destroyContext();
    public static native String getString(int name);
    public static native int displayWidth();
    public static native int displayHeight();
    public static native void installResizeHandler();
    public static native void focusCanvas();
    public static native void installInputHandler();
    public static native double cursorX();
    public static native double cursorY();
    public static native void pollEvents();
    public static native int[] drainInput();
    public static native void setCursorVisible(boolean visible);
}
