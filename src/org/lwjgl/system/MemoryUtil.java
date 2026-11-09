package org.lwjgl.system;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.IntBuffer;

public final class MemoryUtil {
    public static ByteBuffer memAlloc(int capacity) { return ByteBuffer.allocate(capacity).order(ByteOrder.nativeOrder()); }
    public static IntBuffer memAllocInt(int capacity) { return memAlloc(Math.multiplyExact(capacity, Integer.BYTES)).asIntBuffer(); }
    // Browser bridge copies buffer contents, so native memory is not required.
    public static void memFree(ByteBuffer buffer) {}
    public static void memFree(IntBuffer buffer) {}
}
