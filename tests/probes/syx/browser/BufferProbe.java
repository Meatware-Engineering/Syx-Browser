package syx.browser;
import java.nio.*;
import org.lwjgl.BufferUtils;
import org.lwjgl.system.MemoryUtil;
public final class BufferProbe {
    public static void main(String[] args) {
        ByteBuffer b = BufferUtils.createByteBuffer(24);
        if (b.isDirect() || b.order() != ByteOrder.nativeOrder()) throw new AssertionError("Byte buffer type/order");
        b.put(0, (byte) 255); b.put(1, (byte) 128);
        if ((b.get(0) & 255) != 255 || (b.get(1) & 255) != 128) throw new AssertionError("Byte content");
        IntBuffer i=BufferUtils.createIntBuffer(4); i.put(1, 0x12345678);
        if(i.get(1)!=0x12345678) throw new AssertionError("Int content");
        DoubleBuffer d=BufferUtils.createDoubleBuffer(2); d.put(1, 123.5);
        if(d.get(1)!=123.5) throw new AssertionError("Double content");
        ByteBuffer m=MemoryUtil.memAlloc(4); m.put(new byte[]{1,2,3,4}).flip();
        if(m.get()!=1 || m.get()!=2 || m.get()!=3 || m.get()!=4) throw new AssertionError("memAlloc content");
        System.out.println("Heap buffer probe: PASS");
    }
}
