package org.lwjgl.opengl;

public final class GL {
    private static GLCapabilities capabilities;
    public static GLCapabilities createCapabilities() { return capabilities = new GLCapabilities(); }
    public static GLCapabilities getCapabilities() { return capabilities; }
    public static void setCapabilities(GLCapabilities value) { capabilities = value; }
}
