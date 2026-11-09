package org.lwjgl.system;

import java.nio.IntBuffer;

public final class MemoryStack implements AutoCloseable {
    public static MemoryStack stackPush() { return new MemoryStack(); }
    public IntBuffer mallocInt(int capacity) { return MemoryUtil.memAllocInt(capacity); }
    public void close() {}
}
