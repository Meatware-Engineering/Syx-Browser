package syx.browser;
public final class BrowserAudio {
    private BrowserAudio() {}
    public static native int load(String name, byte[] encoded, int category);
    public static native boolean playEffect(int id, float gain, float pitch, boolean spatial, int x, int y);
    // Reports request acceptance; isPlaying also keeps a pending PCM restoration busy.
    public static native boolean playStream(int id, boolean restart);
    public static native void stopStream(int id);
    public static native void setStreamGain(int id, double value);
    public static native void setStreamLoop(int id, boolean loop);
    public static native void setStreamPosition(int id, int x, int y);
    public static native double length(int id);
    public static native double progress(int id);
    public static native boolean isPlaying(int id);
    public static native void setListener(int x, int y);
    public static native void setGain(int category, double gain);
    public static native void setMuteOnFocus(boolean value);
    public static native void stopAll();
    public static native void dispose();
}
