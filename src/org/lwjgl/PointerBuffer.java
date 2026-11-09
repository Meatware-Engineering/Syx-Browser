package org.lwjgl;

public final class PointerBuffer {
    private int position;
    public int capacity() { return 1; }
    public long get() {
        if (position++ != 0) throw new IndexOutOfBoundsException();
        return 1;
    }
}
