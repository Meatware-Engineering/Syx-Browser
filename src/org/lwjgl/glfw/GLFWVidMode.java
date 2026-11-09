package org.lwjgl.glfw;

import org.lwjgl.system.CustomBuffer;
import syx.browser.BrowserBridge;

public final class GLFWVidMode {
    public int width() { return BrowserBridge.displayWidth(); }
    public int height() { return BrowserBridge.displayHeight(); }
    // shortcut: browsers do not expose a reliable refresh rate; use frame timing when available.
    public int refreshRate() { return 60; }
    public int redBits() { return 8; }
    public int greenBits() { return 8; }
    public int blueBits() { return 8; }

    public static final class Buffer extends CustomBuffer {
        private int position;
        private final GLFWVidMode mode = new GLFWVidMode();
        public int capacity() { return 1; }
        public int width() { return mode.width(); }
        public int height() { return mode.height(); }
        public int refreshRate() { return mode.refreshRate(); }
        public int position() { return position; }
        public CustomBuffer position(int value) {
            if (value < 0 || value > capacity()) throw new IllegalArgumentException();
            position = value;
            return this;
        }
    }
}
