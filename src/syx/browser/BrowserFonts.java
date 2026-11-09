package syx.browser;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import snake2d.util.sets.LinkedList;

public final class BrowserFonts {
    public static void addEnglishCyrillic(LinkedList<Path> paths, String language) {
        if (language != null || !Files.isRegularFile(Path.of("base", "locale.zip"))) return;
        try {
            Method open = init.paths.PATHS.class.getDeclaredMethod("getFromZip", String.class);
            open.setAccessible(true);
            Path root = (Path) open.invoke(null, "locale");
            Path font = root.resolve("chars/eastern");
            if (Files.isDirectory(font)) paths.add(font);
        } catch (ReflectiveOperationException | RuntimeException error) {
            System.err.println("Could not load Cyrillic font: " + error);
        }
    }
}
// shortcut: this font lacks ª; merge the original glyph if English needs it.
