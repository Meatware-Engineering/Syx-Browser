package syx.browser;
import java.nio.ByteBuffer;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL30;
public final class ReadPixelsProbe {
    public static void main(String[] args) {
        if (!BrowserBridge.createContext(4, 4)) throw new AssertionError("No WebGL context");
        GL11.glClearColor(1, 0.5f, 0, 1);
        GL11.glClear(0x4000);
        GL11.glReadBuffer(0x405);
        ByteBuffer pixels = ByteBuffer.allocate(12);
        for (int i=0;i<pixels.capacity();i++) pixels.put(i,(byte)99);
        pixels.position(4); pixels.limit(8);
        GL11.glReadPixels(0,0,1,1,6408,5121,pixels);
        if (pixels.position()!=4 || (pixels.get(4)&255)!=255 || (pixels.get(5)&255)!=128 || pixels.get(6)!=0 || (pixels.get(7)&255)!=255) throw new AssertionError("Pixel or position mismatch");
        pixels.limit(12);
        if (pixels.get(3)!=99 || pixels.get(8)!=99) throw new AssertionError("Readback overwrote surrounding data");
        int texture=GL11.glGenTextures();
        GL11.glBindTexture(0x0de1,texture);
        GL11.glTexImage2D(0x0de1,0,0x8058,2,2,0,6408,5121,null);
        int framebuffer=GL30.glGenFramebuffers();
        GL30.glBindFramebuffer(0x8d40,framebuffer);
        GL30.glFramebufferTexture2D(0x8d40,0x8ce0,0x0de1,texture,0);
        if(GL30.glCheckFramebufferStatus(0x8d40)!=0x8cd5)throw new AssertionError("Incomplete framebuffer");
        GL11.glClearColor(0,0,1,1); GL11.glClear(0x4000); GL11.glReadBuffer(0x8ce0);
        pixels.position(4); pixels.limit(8); GL11.glReadPixels(0,0,1,1,6408,5121,pixels);
        if(pixels.get(4)!=0 || pixels.get(5)!=0 || (pixels.get(6)&255)!=255)throw new AssertionError("Framebuffer readback mismatch");
        System.out.println("ReadPixels probe: PASS");
        BrowserBridge.destroyContext();
    }
}
