package org.lwjgl.opengl;

import java.nio.IntBuffer;

public final class GL20 {
    public static native int glCreateProgram();
    public static native int glCreateShader(int type);
    private static native void shaderSource(int shader, String source);
    public static void glShaderSource(int shader, CharSequence source) { shaderSource(shader, source.toString()); }
    public static native void glCompileShader(int shader);
    public static native int glGetShaderi(int shader, int name);
    public static native String glGetShaderInfoLog(int shader, int length);
    public static native void glAttachShader(int program, int shader);
    public static native void glDetachShader(int program, int shader);
    public static native void glDeleteShader(int shader);
    public static native void glDeleteProgram(int program);
    public static native void glLinkProgram(int program);
    public static native int glGetProgrami(int program, int name);
    public static native void glUseProgram(int program);
    private static native int getUniformLocation(int program, String name);
    public static int glGetUniformLocation(int program, CharSequence name) { return getUniformLocation(program, name.toString()); }
    public static native void glUniform1i(int location, int value);
    public static native void glUniform1f(int location, float value);
    public static native void glUniform2f(int location, float x, float y);
    public static native void glUniform3f(int location, float x, float y, float z);
    public static native void glVertexAttribPointer(int index, int size, int type, boolean normalized, int stride, long pointer);
    public static native void glEnableVertexAttribArray(int index);
    public static native void glDisableVertexAttribArray(int index);
    public static native void glDrawElements(int mode, int count, int type, long offset);
    private static native void drawBuffers(int[] buffers);
    public static void glDrawBuffers(IntBuffer values) {
        IntBuffer copy = values.duplicate();
        int[] buffers = new int[copy.remaining()];
        copy.get(buffers);
        drawBuffers(buffers);
    }
    public static void glDrawBuffers(int buffer) { drawBuffers(new int[]{buffer}); }
}
