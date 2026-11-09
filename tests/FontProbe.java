import java.nio.file.Path;
import snake2d.util.sets.LinkedList;
import syx.browser.BrowserFonts;

public class FontProbe {
 public static void main(String[] args) {
  LinkedList<Path> localized = new LinkedList<>();
  BrowserFonts.addEnglishCyrillic(localized, "ru");
  if (localized.size() != 0) throw new AssertionError("Changed localized font");
  LinkedList<Path> english = new LinkedList<>();
  BrowserFonts.addEnglishCyrillic(english, null);
  int expected = Boolean.parseBoolean(args[0]) ? 1 : 0;
  if (english.size() != expected) throw new AssertionError("Unexpected font count: " + english.size());
  if (expected == 1 && !english.getFirst().endsWith("chars/eastern")) throw new AssertionError("Wrong font");
  System.out.println("Font selection: PASS");
 }
}
