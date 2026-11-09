package snake2d;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import snake2d.util.datatypes.RECTANGLE;
import syx.browser.BrowserAudio;

// The browser does not expose OpenAL; play the original assets through Web Audio.
final class SoundCoreDummy extends SOUND_CORE {
    private final Map<String, Integer> effects = new HashMap<>();
    private int generation;
    private int load(Path path, int category) {
        try { return BrowserAudio.load(path.toString(), Files.readAllBytes(path), category); }
        catch (IOException error) { System.err.println("Could not read audio: " + path + ": " + error); return 0; }
    }
    public void set(int x, int y) { BrowserAudio.setListener(x, y); }
    public void stopAllSounds() { BrowserAudio.stopAll(); }
    void dis() { disposeSounds(); }
    boolean requestMono(AbsBuffer b, int x, int y, boolean p, float g, float v) { return false; }
    boolean requestMono(AbsBuffer b, boolean p, float g, float v) { return false; }
    boolean requestStereo(AbsBuffer b) { return false; }
    public void setGain(double value, AUDIO_GAIN_TYPE type) { BrowserAudio.setGain(type.ordinal(), value); }
    public void setMuteOnFocus(boolean value) { BrowserAudio.setMuteOnFocus(value); }
    public void disposeSounds() { BrowserAudio.dispose(); effects.clear(); generation++; }
    public SoundEffect getEffect(Path path) { return new Effect(path); }
    public SoundStream getStream(Path path, boolean music) { return new Stream(path, music ? 1 : 2, false); }
    public SoundEffectStream getStreamMono(Path path) { return new Stream(path, 2, true); }

    private final class Effect implements SoundEffect {
        private final Path path;
        Effect(Path path) { this.path = path; }
        private int id() {
            // Only cache successful loads: 0 means the asset was unreadable/undecodable or the load
            // was cancelled by a reset, and must be retried on the next request instead of sticking.
            Integer cached = effects.get(path.toString());
            if (cached != null) return cached;
            int loaded = load(path, 3);
            if (loaded != 0) effects.put(path.toString(), loaded);
            return loaded;
        }
        public boolean play(int x, int y, float pitch, float gain, boolean priority) { return BrowserAudio.playEffect(id(), gain, pitch, true, x, y); }
        public boolean play(RECTANGLE rect, float pitch, float gain, boolean priority) { return play(rect.cX(), rect.cY(), pitch, gain, priority); }
        public boolean play(int x, int y, boolean priority) { return play(x, y, 1, 1, priority); }
        public boolean play(float pitch, float gain, boolean priority) { return BrowserAudio.playEffect(id(), gain, pitch, false, 0, 0); }
        public boolean play(boolean priority) { return play(1, 1, priority); }
        public float lengthInSeconds() { return (float) BrowserAudio.length(id()); }
    }
    private final class Stream implements SoundEffectStream {
        private final Path path;
        private final int category;
        private final boolean spatial;
        private int id, x, y, loadedGeneration = -1;
        private double gain = 1;
        private boolean looping;
        Stream(Path path, int category, boolean spatial) { this.path=path; this.category=category; this.spatial=spatial; }
        private int id() {
            if (loadedGeneration != generation) { id = 0; loadedGeneration = generation; }
            if (id == 0) {
                id=load(path, category);
                if (id != 0) { BrowserAudio.setStreamGain(id, gain); BrowserAudio.setStreamLoop(id, looping); if (spatial) BrowserAudio.setStreamPosition(id,x,y); }
            }
            return id;
        }
        public boolean play() { int sound=id(); if (sound == 0) return false; BrowserAudio.setStreamLoop(sound, looping); return BrowserAudio.playStream(sound, true); }
        public void playOnce() { int sound=id(); if (sound != 0) { if (BrowserAudio.isPlaying(sound)) BrowserAudio.stopStream(sound); else { BrowserAudio.setStreamLoop(sound,looping); BrowserAudio.playStream(sound,true); } } }
        public void setGain(double value) { if (value < 0 || value > 1) throw new IllegalArgumentException("Gain must be between 0 and 1"); gain=value; if(id!=0) BrowserAudio.setStreamGain(id,value); }
        public void stop() { if(id!=0) BrowserAudio.stopStream(id); }
        public void resume() { int sound=id(); if (sound != 0) { BrowserAudio.setStreamLoop(sound,looping); BrowserAudio.playStream(sound,false); } }
        public void setLooping(boolean value) { looping=value; if(id!=0) BrowserAudio.setStreamLoop(id,value); }
        public double getProgress() { return id==0 || !BrowserAudio.isPlaying(id) ? 0 : BrowserAudio.progress(id); }
        public boolean isPlaying() { return id!=0 && BrowserAudio.isPlaying(id); }
        public double getLengthInSeconds() { int sound=id(); return sound==0 ? 0 : BrowserAudio.length(sound); }
        public void setCoos(int x, int y) { this.x=x; this.y=y; if(id!=0) BrowserAudio.setStreamPosition(id,x,y); }
    }
}
