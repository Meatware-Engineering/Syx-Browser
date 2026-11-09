package org.lwjgl.opengl;

import java.nio.ByteBuffer;
import java.nio.IntBuffer;

public final class GL15Baseline {
    public static native int glGenBuffers();
    public static native void glBindBuffer(int target, int buffer);
    public static native void glDeleteBuffers(int buffer);
    private static native void bufferDataBytes(int target, byte[] data, int usage);
    private static native void bufferDataInts(int target, int[] data, int usage);
    private static native void bufferSubDataBytes(int target, long offset, byte[] data);
    public static void glBufferData(int target, ByteBuffer buffer, int usage) {
        ByteBuffer copy = buffer.duplicate();
        byte[] data = new byte[copy.remaining()];
        copy.get(data);
        bufferDataBytes(target, data, usage);
    }
    public static void glBufferData(int target, IntBuffer buffer, int usage) {
        IntBuffer copy = buffer.duplicate();
        int[] data = new int[copy.remaining()];
        copy.get(data);
        bufferDataInts(target, data, usage);
    }
    public static void glBufferSubData(int target, long offset, ByteBuffer buffer) {
        ByteBuffer copy = buffer.duplicate();
        byte[] data = new byte[copy.remaining()];
        copy.get(data);
        bufferSubDataBytes(target, offset, data);
    }
}
