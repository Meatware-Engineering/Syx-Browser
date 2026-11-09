package org.lwjgl.opengl;

import java.nio.ByteBuffer;
import java.nio.IntBuffer;

public final class GL15 {
    public static native int glGenBuffers();
    public static native void glBindBuffer(int target, int buffer);
    public static native void glDeleteBuffers(int buffer);
    private static native void bufferDataBytes(int target, byte[] data, int usage);
    private static native void bufferDataInts(int target, int[] data, int usage);
    private static native void bufferSubDataBytes(int target, long offset, byte[] data);
    private static native void bufferDataByteRange(int target, byte[] data, int start, int length, int usage);
    private static native void bufferSubDataByteRange(int target, long offset, byte[] data, int start, int length);
    public static void glBufferData(int target, ByteBuffer buffer, int usage) {
        if (buffer.hasArray()) {
            bufferDataByteRange(target, buffer.array(), buffer.arrayOffset() + buffer.position(), buffer.remaining(), usage);
            return;
        }
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
        if (buffer.hasArray()) {
            bufferSubDataByteRange(target, offset, buffer.array(), buffer.arrayOffset() + buffer.position(), buffer.remaining());
            return;
        }
        ByteBuffer copy = buffer.duplicate();
        byte[] data = new byte[copy.remaining()];
        copy.get(data);
        bufferSubDataBytes(target, offset, data);
    }
}
