package syx.browser;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import snake2d.util.file.FileGetter;
import snake2d.util.file.FilePutter;

public final class FileIOProbe {
    public static void main(String[] args) throws Exception {
        byte[] data = new byte[31290];
        for (int i = 0; i < data.length; i++) data[i] = (byte)(i * 31);
        ByteBuffer.wrap(data).putInt(data.length - 4, 669966991);
        Path path = Path.of("/files/syx-io-probe.bin");
        try (FileChannel channel = new FileOutputStream(path.toFile()).getChannel()) {
            ByteBuffer source = ByteBuffer.wrap(data);
            while (source.hasRemaining()) channel.write(source);
        }
        byte[] viaFiles = Files.readAllBytes(path);
        ByteBuffer viaChannel = ByteBuffer.allocate(data.length);
        try (FileChannel channel = new FileInputStream(path.toFile()).getChannel()) {
            while (viaChannel.hasRemaining() && channel.read(viaChannel) >= 0) {}
        }
        System.out.println("IO probe write+Files.read: " + Arrays.equals(data, viaFiles));
        System.out.println("IO probe write+FileChannel.read: " + Arrays.equals(data, viaChannel.array()));
        System.out.println("IO probe expected/files/channel tail: " + ByteBuffer.wrap(data).getInt(data.length - 4) + "/" + ByteBuffer.wrap(viaFiles).getInt(viaFiles.length - 4) + "/" + viaChannel.getInt(data.length - 4));
        Files.delete(path);
        ByteBuffer directProbe = ByteBuffer.allocate(262144);
        directProbe.position(31286);
        directProbe.putInt(669966991);
        System.out.println("Large ByteBuffer sentinel: " + directProbe.getInt(31286));
        for (int offset : new int[]{0, 1, 2, 3, 1024, 8192, 16384, 30000, 31284, 31285, 31286, 31287, 32768, 65536, 131072}) {
            ByteBuffer test = ByteBuffer.allocate(262144);
            test.position(offset); test.putInt(669966991);
            System.out.println("Buffer at " + offset + " = " + test.getInt(offset));
            if (offset == 2) System.out.println("Unaligned bytes: " + (test.get(offset) & 255) + "," + (test.get(offset + 1) & 255) + "," + (test.get(offset + 2) & 255) + "," + (test.get(offset + 3) & 255));
        }
        ByteBuffer readProbe = ByteBuffer.allocate(20);
        readProbe.put(2, (byte) 0x27); readProbe.put(3, (byte) 0xee); readProbe.put(4, (byte) 0xe2); readProbe.put(5, (byte) 0x8f);
        System.out.println("Manual bytes, unaligned getInt: " + readProbe.getInt(2));
        for (int offset = 0; offset < 8; offset++) {
            ByteBuffer b = ByteBuffer.allocate(24); b.position(offset); b.putLong(0x1122334455667788L);
            System.out.println("Long at " + offset + " = " + Long.toHexString(b.getLong(offset)));
            ByteBuffer s = ByteBuffer.allocate(24); s.position(offset); s.putShort((short) 0x1234);
            System.out.println("Short at " + offset + " = " + Integer.toHexString(s.getShort(offset) & 65535) + " bytes=" + (s.get(offset) & 255) + "," + (s.get(offset + 1) & 255));
        }
        FilePutter large = new FilePutter(path, 262144);
        for (int i = 0; i < 31282; i++) large.b((byte) 0x55);
        large.i(669966991);
        large.save();
        byte[] largeBytes = Files.readAllBytes(path);
        System.out.println("Large unaligned tail: " + java.util.HexFormat.of().formatHex(Arrays.copyOfRange(largeBytes, largeBytes.length - 4, largeBytes.length)));
        System.out.println("Large unaligned lastInt: " + new FileGetter(path).lastInt());
        Files.delete(path);
        FilePutter textWriter = new FilePutter(path, 1024);
        textWriter.chars("sprite/font/Small.png");
        textWriter.i(669966991);
        textWriter.save();
        String text = new FileGetter(path).chars();
        if (!"sprite/font/Small.png".equals(text)) throw new AssertionError("String round-trip failed: " + text);
        System.out.println("Game string round-trip: OK");
        Files.delete(path);
        FilePutter unaligned = new FilePutter(path, 1024);
        unaligned.b((byte) 7);
        unaligned.i(17);
        unaligned.i(669966991);
        unaligned.save();
        byte[] unalignedBytes = Files.readAllBytes(path);
        System.out.println("Unaligned FilePutter bytes: " + java.util.HexFormat.of().formatHex(unalignedBytes));
        System.out.println("Unaligned FileGetter lastInt: " + new FileGetter(path).lastInt());
        Files.delete(path);
        FilePutter writer = new FilePutter(path, 1024);
        writer.i(17);
        writer.i(669966991);
        writer.save();
        byte[] saved = Files.readAllBytes(path);
        System.out.println("FilePutter bytes: " + java.util.HexFormat.of().formatHex(saved));
        System.out.println("FileGetter lastInt: " + new FileGetter(path).lastInt());
        Files.delete(path);
    }
}
