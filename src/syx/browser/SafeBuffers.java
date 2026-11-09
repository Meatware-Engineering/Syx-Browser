package syx.browser;

import java.nio.BufferOverflowException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ReadOnlyBufferException;

public final class SafeBuffers {
    private static ByteBuffer put(ByteBuffer buffer, int index, long value, int size) {
        if (buffer.isReadOnly()) throw new ReadOnlyBufferException();
        if (index < 0 || index > buffer.limit() - size) throw new IndexOutOfBoundsException();
        boolean bigEndian = buffer.order() == ByteOrder.BIG_ENDIAN;
        int low = (int) value, high = size == 8 ? (int) (value >>> 32) : 0;
        if (buffer.hasArray()) {
            byte[] data = buffer.array();
            int start = buffer.arrayOffset() + index;
            for (int i = 0; i < size; i++) {
                int shift = bigEndian ? (size - 1 - i) * 8 : i * 8;
                data[start + i] = (byte) ((shift < 32 ? low : high) >>> (shift & 31));
            }
        } else {
            for (int i = 0; i < size; i++) {
                int shift = bigEndian ? (size - 1 - i) * 8 : i * 8;
                buffer.put(index + i, (byte) ((shift < 32 ? low : high) >>> (shift & 31)));
            }
        }
        return buffer;
    }
    private static ByteBuffer putRelative(ByteBuffer buffer, long value, int size) {
        if (buffer.isReadOnly()) throw new ReadOnlyBufferException();
        if (buffer.remaining() < size) throw new BufferOverflowException();
        int position = buffer.position();
        put(buffer, position, value, size);
        buffer.position(position + size);
        return buffer;
    }
    public static ByteBuffer putInt(ByteBuffer b, int value) { return putRelative(b, value, 4); }
    public static ByteBuffer putShort(ByteBuffer b, short value) { return putRelative(b, value, 2); }
    public static ByteBuffer putShort(ByteBuffer b, int index, short value) { return put(b, index, value, 2); }
    public static ByteBuffer putChar(ByteBuffer b, char value) { return putRelative(b, value, 2); }
    public static ByteBuffer putChar(ByteBuffer b, int index, char value) { return put(b, index, value, 2); }
    public static ByteBuffer putInt(ByteBuffer b, int index, int value) { return put(b, index, value, 4); }
    public static ByteBuffer putLong(ByteBuffer b, long value) { return putRelative(b, value, 8); }
    public static ByteBuffer putLong(ByteBuffer b, int index, long value) { return put(b, index, value, 8); }
    public static ByteBuffer putFloat(ByteBuffer b, float value) { return putInt(b, Float.floatToRawIntBits(value)); }
    public static ByteBuffer putFloat(ByteBuffer b, int index, float value) { return putInt(b, index, Float.floatToRawIntBits(value)); }
    public static ByteBuffer putDouble(ByteBuffer b, double value) { return putLong(b, Double.doubleToRawLongBits(value)); }
    public static ByteBuffer putDouble(ByteBuffer b, int index, double value) { return putLong(b, index, Double.doubleToRawLongBits(value)); }
}
