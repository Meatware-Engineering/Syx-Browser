package org.lwjgl;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.DoubleBuffer;
import java.nio.IntBuffer;
import java.nio.ShortBuffer;

public final class BufferUtils {
    private BufferUtils() {}
    public static ByteBuffer createByteBuffer(int capacity) { return ByteBuffer.allocate(capacity).order(ByteOrder.nativeOrder()); }
    public static ShortBuffer createShortBuffer(int capacity) { return createByteBuffer(Math.multiplyExact(capacity, Short.BYTES)).asShortBuffer(); }
    public static IntBuffer createIntBuffer(int capacity) { return createByteBuffer(Math.multiplyExact(capacity, Integer.BYTES)).asIntBuffer(); }
    public static DoubleBuffer createDoubleBuffer(int capacity) { return createByteBuffer(Math.multiplyExact(capacity, Double.BYTES)).asDoubleBuffer(); }
}
