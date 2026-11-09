package snake2d;
import java.nio.file.Files;
import java.nio.file.Path;
import java.io.ByteArrayOutputStream;
public final class BrowserAudioProbe {
    private static void le(ByteArrayOutputStream out,int value,int n){ for(int i=0;i<n;i++)out.write(value >>> (8*i)); }
    public static void main(String[] args) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); int sampleBytes=16000;
        out.writeBytes(new byte[]{'R','I','F','F'});le(out,36+sampleBytes,4);out.writeBytes(new byte[]{'W','A','V','E','f','m','t',' '});
        le(out,16,4);le(out,1,2);le(out,1,2);le(out,8000,4);le(out,16000,4);le(out,2,2);le(out,16,2);
        out.writeBytes(new byte[]{'d','a','t','a'});le(out,sampleBytes,4);out.writeBytes(new byte[sampleBytes]);
        Path path=Files.createTempFile(Path.of("/files"),"syx-audio-probe-",".wav"); Files.write(path,out.toByteArray());
        SoundCoreDummy core=new SoundCoreDummy(); SoundStream stream=core.getStream(path,true);
        if(Math.abs(stream.getLengthInSeconds()-1)>0.05 || !stream.play()) throw new AssertionError("Initial stream failed");
        Thread.sleep(250); double progress=stream.getProgress(); if(progress<0.05)throw new AssertionError("Playback did not progress");
        stream.stop(); if(stream.isPlaying() || stream.getProgress()!=0)throw new AssertionError("Stop failed");
        stream.resume(); if(!stream.isPlaying() || stream.getProgress()<progress-0.03)throw new AssertionError("Resume lost position");
        stream.stop(); if(!stream.play() || stream.getProgress()>progress/2)throw new AssertionError("Play did not restart");
        stream.playOnce(); if(stream.isPlaying())throw new AssertionError("Repeated playOnce did not stop stream");
        stream.playOnce(); if(!stream.isPlaying())throw new AssertionError("playOnce did not start stream");
        core.disposeSounds(); if(!stream.play())throw new AssertionError("Stream did not reload after dispose");
        stream.stop(); stream.setLooping(true);
        if(!stream.play())throw new AssertionError("Short loop did not start");
        Thread.sleep(2250);
        double wrapped=stream.getProgress();
        if(!stream.isPlaying() || wrapped<0 || wrapped>=1)throw new AssertionError("Short stream did not keep looping");
        stream.setLooping(false);
        if(!stream.isPlaying())throw new AssertionError("Disabling loop cut off the current cycle");
        Thread.sleep(1100);
        if(stream.isPlaying())throw new AssertionError("Disabling short loop did not allow it to end");
        core.disposeSounds(); Files.delete(path); System.out.println("Java audio stream and short-loop buffer probe: PASS");
    }
}
