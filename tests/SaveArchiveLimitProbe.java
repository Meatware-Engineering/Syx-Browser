import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import syx.browser.SaveArchive;

public class SaveArchiveLimitProbe {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args[0]), source = root.resolve("saves"), zip = root.resolve("backup.zip");
        Files.createDirectories(source);
        try (FileChannel file = FileChannel.open(source.resolve("too-large.save"), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            file.position(512L * 1024 * 1024);
            file.write(ByteBuffer.wrap(new byte[]{1}));
        }
        try {
            SaveArchive.backup(source.toString(), zip.toString());
            throw new AssertionError("Oversized backup was accepted");
        } catch (IOException expected) {
            if (Files.exists(zip)) throw new AssertionError("Incomplete archive was retained");
        }
        System.out.println("Oversized backup rejected: PASS");
    }
}
