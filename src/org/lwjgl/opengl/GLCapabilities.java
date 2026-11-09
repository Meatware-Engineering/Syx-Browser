package org.lwjgl.opengl;

public final class GLCapabilities {
    // shortcut: WebGL 2 is mapped to the used GL 3.x subset; audit each call before claiming full support.
    public boolean OpenGL30 = true;
    public boolean OpenGL33 = true;
    public boolean OpenGL43 = false;
    public boolean GL_AMD_debug_output, GL_ARB_debug_output, GL_KHR_debug, forwardCompatible;
}
