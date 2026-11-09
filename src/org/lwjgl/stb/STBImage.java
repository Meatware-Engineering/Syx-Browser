package org.lwjgl.stb;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.IntBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import org.lwjgl.system.MemoryUtil;

public final class STBImage {
    private static native byte[] decodeImage(byte[] encoded);
    public static ByteBuffer stbi_load(CharSequence path, IntBuffer width, IntBuffer height, IntBuffer channels, int requested) {
        try { return decode(Files.readAllBytes(Path.of(path.toString())), width, height, channels, requested); }
        catch (Exception error) { return null; }
    }
    public static ByteBuffer stbi_load_from_memory(ByteBuffer encoded, IntBuffer width, IntBuffer height, IntBuffer channels, int requested) {
        ByteBuffer copy = encoded.duplicate();
        byte[] bytes = new byte[copy.remaining()];
        copy.get(bytes);
        return decode(bytes, width, height, channels, requested);
    }
    private static ByteBuffer decode(byte[] bytes, IntBuffer width, IntBuffer height, IntBuffer channels, int requested) {
        if (requested != 4) throw new IllegalArgumentException("Only RGBA image decoding is implemented");
        byte[] decoded = decodeImage(bytes);
        if (decoded == null || decoded.length < 8) return null;
        ByteBuffer header = ByteBuffer.wrap(decoded).order(ByteOrder.BIG_ENDIAN);
        int w = header.getInt(), h = header.getInt();
        if (w <= 0 || h <= 0 || (long) w * h * 4 != decoded.length - 8) throw new IllegalArgumentException("Invalid decoded image size");
        width.put(0, w); height.put(0, h); channels.put(0, 4);
        return MemoryUtil.memAlloc(decoded.length - 8).put(decoded, 8, decoded.length - 8).flip();
    }
    public static String stbi_failure_reason() { return "Browser could not decode the image"; }
    public static void stbi_image_free(ByteBuffer image) { MemoryUtil.memFree(image); }
}
