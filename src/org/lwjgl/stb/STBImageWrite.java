package org.lwjgl.stb;

import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;

public final class STBImageWrite {
    private static native byte[] encodeImage(byte[] pixels, int width, int height, int stride, boolean jpeg, int quality);
    private static boolean write(CharSequence path, int width, int height, int channels, ByteBuffer pixels, int stride, boolean jpeg, int quality) {
        if (channels != 4) throw new IllegalArgumentException("Only RGBA image encoding is implemented");
        ByteBuffer copy = pixels.duplicate();
        byte[] bytes = new byte[copy.remaining()];
        copy.get(bytes);
        byte[] encoded = encodeImage(bytes, width, height, stride, jpeg, quality);
        if (encoded == null) return false;
        try { Files.write(Path.of(path.toString()), encoded); return true; }
        catch (Exception error) { error.printStackTrace(); return false; }
    }
    public static boolean stbi_write_png(CharSequence path, int width, int height, int channels, ByteBuffer pixels, int stride) {
        return write(path, width, height, channels, pixels, stride, false, 100);
    }
    public static boolean stbi_write_jpg(CharSequence path, int width, int height, int channels, ByteBuffer pixels, int quality) {
        return write(path, width, height, channels, pixels, 0, true, quality);
    }
}
