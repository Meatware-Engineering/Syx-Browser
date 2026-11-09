package snake2d;

import java.nio.file.Files;
import java.nio.file.Path;
import syx.browser.BrowserAudio;

public final class EffectLoadRetryProbe {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        Path asset = Files.createTempFile("syx-effect-retry-", ".test");
        try {
            Files.write(asset, new byte[]{1});
            SoundCoreDummy core = new SoundCoreDummy();
            SoundEffect effect = core.getEffect(asset);
            check(!effect.play(false), "first transient load failure must reject playback");
            check(BrowserAudio.loads == 1, "one first load attempt");
            check(effect.play(false), "a failed effect must retry on the next play");
            check(BrowserAudio.loads == 2, "one retry after failure");
            int cached = BrowserAudio.lastPlayed;
            check(core.getEffect(asset).play(false), "another handle must share the successful cache");
            check(BrowserAudio.loads == 2 && BrowserAudio.lastPlayed == cached, "successful id must remain cached");
            check(effect.lengthInSeconds() == 1 && BrowserAudio.loads == 2, "length must use cached id");
            core.disposeSounds();
            check(effect.play(false) && BrowserAudio.loads == 3, "dispose must allow reloading the effect");
            check(BrowserAudio.lastPlayed != cached, "dispose must not reuse the previous sound id");
            System.out.println("Java effect load retry and successful cache reuse: PASS");
        } finally { Files.deleteIfExists(asset); }
    }
}
