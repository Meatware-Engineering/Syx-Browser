package syx.browser;
public final class BrowserCompat {
    private BrowserCompat() {}
    public static StackTraceElement[] stackTrace(Thread thread) {
        try { return thread.getStackTrace(); }
        catch (RuntimeException unsupported) { return new StackTraceElement[0]; }
    }
}
