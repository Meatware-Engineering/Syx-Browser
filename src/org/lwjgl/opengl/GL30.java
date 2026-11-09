package org.lwjgl.opengl;

public final class GL30 {
    public static native void glBindFramebuffer(int target, int framebuffer);
    public static native void glBlitFramebuffer(int sx0, int sy0, int sx1, int sy1, int dx0, int dy0, int dx1, int dy1, int mask, int filter);
    public static native int glGetFramebufferAttachmentParameteri(int target, int attachment, int name);
    public static native int glGenVertexArrays();
    public static native void glBindVertexArray(int array);
    public static native void glDeleteVertexArrays(int array);
    public static native void glVertexAttribIPointer(int index, int size, int type, int stride, long pointer);
    public static native int glGenFramebuffers();
    public static native int glGenRenderbuffers();
    public static native void glBindRenderbuffer(int target, int buffer);
    public static native void glRenderbufferStorage(int target, int format, int width, int height);
    public static native void glFramebufferTexture2D(int target, int attachment, int textureTarget, int texture, int level);
    public static native void glFramebufferRenderbuffer(int target, int attachment, int renderbufferTarget, int renderbuffer);
    public static native int glCheckFramebufferStatus(int target);
    public static native void glDeleteFramebuffers(int framebuffer);
    public static native void glDeleteRenderbuffers(int renderbuffer);
}
