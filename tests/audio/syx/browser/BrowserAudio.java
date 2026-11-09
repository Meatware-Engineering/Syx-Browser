package syx.browser;

// Test double for the browser native boundary. The real SoundCoreDummy is compiled unchanged.
public final class BrowserAudio {
    public static int loads;
    public static int lastPlayed;
    public static boolean failNext = true;
    public static int load(String name, byte[] bytes, int category) {
        loads++;
        if (failNext) { failNext = false; return 0; }
        return loads + 100;
    }
    public static boolean playEffect(int id, float gain, float pitch, boolean spatial, int x, int y) {
        lastPlayed = id; return id != 0;
    }
    public static boolean playStream(int id, boolean restart) { return id != 0; }
    public static boolean isPlaying(int id) { return false; }
    public static double length(int id) { return id == 0 ? 0 : 1; }
    public static double progress(int id) { return 0; }
    public static void stopStream(int id) {}
    public static void setStreamGain(int id, double gain) {}
    public static void setStreamLoop(int id, boolean loop) {}
    public static void setStreamPosition(int id, int x, int y) {}
    public static void setListener(int x, int y) {}
    public static void setGain(int category, double gain) {}
    public static void setMuteOnFocus(boolean value) {}
    public static void stopAll() {}
    public static void dispose() {}
}
