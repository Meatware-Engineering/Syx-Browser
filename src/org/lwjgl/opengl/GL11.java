package org.lwjgl.opengl;

import syx.browser.BrowserBridge;
import java.nio.ByteBuffer;

public final class GL11 {
    public static String glGetString(int name) { return BrowserBridge.getString(name); }
    public static native int glGetError();
    public static native int glGetInteger(int name);
    private static native int getIntegerAt(int name, int index);
    public static void glGetIntegerv(int name, int[] values) {
        for (int i = 0; i < values.length; i++) values[i] = getIntegerAt(name, i);
    }
    public static native void glClearColor(float r, float g, float b, float a);
    public static native void glEnable(int capability);
    public static native void glDisable(int capability);
    public static native void glDepthMask(boolean enabled);
    public static native void glDepthFunc(int function);
    public static native void glColorMask(boolean red, boolean green, boolean blue, boolean alpha);
    public static native void glStencilFunc(int function, int reference, int mask);
    private static boolean stencilOpKnown;
    private static int stencilFail, stencilDepthFail, stencilPass;
    private static native void setStencilOp(int fail, int depthFail, int pass);
    public static void resetStencilCache() { stencilOpKnown = false; }
    private static boolean validStencilOp(int value) {
        return value == 0 || value == 5386 || value >= 7680 && value <= 7683 || value == 34055 || value == 34056;
    }
    public static void glStencilOp(int fail, int depthFail, int pass) {
        // Invalid enums must reach GL every time so glGetError keeps its semantics.
        if (!validStencilOp(fail) || !validStencilOp(depthFail) || !validStencilOp(pass)) { setStencilOp(fail, depthFail, pass); return; }
        if (stencilOpKnown && fail == stencilFail && depthFail == stencilDepthFail && pass == stencilPass) return;
        setStencilOp(fail, depthFail, pass);
        stencilFail = fail; stencilDepthFail = depthFail; stencilPass = pass; stencilOpKnown = true;
    }
    public static native void glPointSize(float size);
    public static void glDrawElements(int mode, int count, int type, long offset) { GL20.glDrawElements(mode, count, type, offset); }
    public static native void glClearStencil(int value);
    public static native void glClearDepth(double value);
    public static native void glBlendFunc(int source, int destination);
    public static native void glViewport(int x, int y, int width, int height);
    public static native void glReadBuffer(int buffer);
    private static native byte[] readPixels(int x, int y, int width, int height, int format, int type);
    public static void glReadPixels(int x, int y, int width, int height, int format, int type, ByteBuffer pixels) {
        // shortcut: the game reads RGBA bytes only; extend formats if that changes.
        if (format != 6408 || type != 5121) throw new UnsupportedOperationException("Browser readback supports RGBA unsigned bytes");
        ByteBuffer copy = pixels.duplicate();
        if (width < 0 || height < 0) throw new IllegalArgumentException("Negative image size");
        int length = Math.multiplyExact(Math.multiplyExact(width, height), 4);
        if (copy.remaining() < length) throw new IllegalArgumentException("Pixel buffer is too small");
        byte[] data = readPixels(x, y, width, height, format, type);
        copy.put(data);
    }
    public static native int glGenTextures();
    public static native void glBindTexture(int target, int texture);
    public static native void glDeleteTextures(int texture);
    public static native void glTexParameterf(int target, int name, float value);
    public static native void glTexParameteri(int target, int name, int value);
    private static native void texImage2D(int target, int level, int internal, int width, int height, int border, int format, int type, byte[] data);
    public static void glTexImage2D(int target, int level, int internal, int width, int height, int border, int format, int type, ByteBuffer pixels) {
        byte[] data = null;
        if (pixels != null) { ByteBuffer copy = pixels.duplicate(); data = new byte[copy.remaining()]; copy.get(data); }
        texImage2D(target, level, internal, width, height, border, format, type, data);
    }
    private static native void texSubImage2D(int target, int level, int x, int y, int width, int height, int format, int type, byte[] data);
    public static void glTexSubImage2D(int target, int level, int x, int y, int width, int height, int format, int type, ByteBuffer pixels) {
        ByteBuffer copy = pixels.duplicate(); byte[] data = new byte[copy.remaining()]; copy.get(data);
        texSubImage2D(target, level, x, y, width, height, format, type, data);
    }
    public static native void glClear(int mask);
}
