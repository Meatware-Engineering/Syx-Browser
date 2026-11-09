package syx.browser;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public final class SaveArchive {
    private static final long MAX_BYTES = 512L * 1024 * 1024;
    private static final int MAX_FILES = 10000;
    private SaveArchive() {}

    public static int backup(String folder, String destination) throws IOException {
        Path root = Path.of(folder), target = Path.of(destination);
        if (!Files.isDirectory(root)) throw new IOException("No saved games found");
        int count = 0; long total = 0;
        if (Files.exists(target)) throw new java.nio.file.FileAlreadyExistsException(target.toString());
        OutputStream output = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW);
        try (var files = Files.walk(root);
             output;
             ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Path file : files.filter(Files::isRegularFile).sorted().toList()) {
                if (Files.isSymbolicLink(file)) throw new IOException("Symbolic links are not supported");
                long size = Files.size(file);
                if (++count > MAX_FILES || size > MAX_BYTES - total) throw new IOException("Backup is too large");
                total += size;
                zip.putNextEntry(new ZipEntry(root.relativize(file).toString().replace('\\', '/')));
                Files.copy(file, zip); zip.closeEntry();
            }
        } catch (IOException error) { Files.deleteIfExists(target); throw error; }
        if (count == 0 || Files.size(target) > MAX_BYTES) { Files.deleteIfExists(target); throw new IOException("Backup is empty or too large"); }
        return count;
    }

    public static String restore(String folder, String source) throws IOException {
        // A stream reader accepts a ZIP cut between complete entries; validate its directory too.
        long archivedFiles;
        try (var archive = new java.util.zip.ZipFile(source)) {
            archivedFiles = archive.stream().filter(entry -> !entry.isDirectory()).count();
        }
        Path root = Path.of(folder), staging = Files.createTempDirectory(Path.of("/files"), "syx-import-");
        int restored = 0, skipped = 0, count = 0; long total = 0;
        Set<Path> seen = new HashSet<>();
        try {
            try (InputStream input = Files.newInputStream(Path.of(source)); ZipInputStream zip = new ZipInputStream(input)) {
                for (ZipEntry entry; (entry = zip.getNextEntry()) != null;) {
                    String name = entry.getName();
                    if (name.startsWith("/") || name.contains("\\") || name.contains(":")) throw new IOException("Invalid archive path");
                    Path relative = Path.of(name).normalize();
                    if (relative.isAbsolute() || relative.startsWith("..") || relative.toString().isEmpty()) throw new IOException("Invalid archive path");
                    if (entry.isDirectory()) continue;
                    if (++count > MAX_FILES || !seen.add(relative)) throw new IOException("Too many files or duplicate archive path");
                    Path staged = staging.resolve(relative); Files.createDirectories(staged.getParent());
                    try (OutputStream output = Files.newOutputStream(staged, StandardOpenOption.CREATE_NEW)) {
                        byte[] bytes = new byte[65536];
                        for (int n; (n = zip.read(bytes)) != -1;) {
                            total += n; if (total > MAX_BYTES) throw new IOException("Archive is too large");
                            output.write(bytes, 0, n);
                        }
                    }
                    zip.closeEntry();
                }
            }
            if (count == 0 || count != archivedFiles) throw new IOException("Archive is empty or incomplete");
            for (Path relative : seen) {
                Path destination = root.resolve(relative);
                for (Path current = destination.getParent(); current != null && current.startsWith(root); current = current.getParent()) {
                    if (Files.isSymbolicLink(current)) throw new IOException("Symbolic links are not supported");
                }
                Files.createDirectories(destination.getParent());
                if (Files.exists(destination, java.nio.file.LinkOption.NOFOLLOW_LINKS)) { skipped++; continue; }
                try { Files.copy(staging.resolve(relative), destination); restored++; }
                catch (java.nio.file.FileAlreadyExistsException exists) { skipped++; }
            }
            return "Восстановлено: " + restored + "; пропущено существующих: " + skipped;
        } finally {
            try (var paths = Files.walk(staging)) {
                for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }

    public static String importSave(String folder, String source, String name) throws IOException {
        if (name == null || name.length() > 255 || !name.toLowerCase(java.util.Locale.ROOT).endsWith(".save")
                || name.contains("/") || name.contains("\\") || name.contains(":")) throw new IOException("Invalid save name");
        Path archive = Files.createTempFile(Path.of("/files"), "syx-native-", ".zip");
        try {
            try (InputStream input = Files.newInputStream(Path.of(source));
                 ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(archive))) {
                zip.putNextEntry(new ZipEntry("saves/" + name));
                byte[] bytes = new byte[65536]; long total = 0;
                for (int n; (n = input.read(bytes)) != -1;) {
                    total += n; if (total > MAX_BYTES) throw new IOException("Save is too large");
                    zip.write(bytes, 0, n);
                }
                zip.closeEntry();
            }
            return restore(folder, archive.toString());
        } finally { Files.deleteIfExists(archive); }
    }

    public static void removeTemporary(String path) throws IOException { Files.deleteIfExists(Path.of(path)); }
}
