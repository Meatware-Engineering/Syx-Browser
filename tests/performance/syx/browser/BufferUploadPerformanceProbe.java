package syx.browser;
import java.nio.*;
import java.util.Arrays;
import org.lwjgl.opengl.GL15;
import org.lwjgl.opengl.GL15Baseline;
public final class BufferUploadPerformanceProbe {
    private static native void report(String text);
    private static native boolean bufferEquals(byte[] expected,int offset);
    private static native int error();
    private static final int TARGET=34962,USAGE=35048;
    private static int checks;
    private static byte[] bytes(ByteBuffer b){ByteBuffer c=b.duplicate();byte[] result=new byte[c.remaining()];c.get(result);return result;}
    private static void verify(String name,ByteBuffer b){
        int position=b.position(),limit=b.limit();byte[] expected=bytes(b);
        GL15.glBufferData(TARGET,b,USAGE);
        if(!bufferEquals(expected,0)||b.position()!=position||b.limit()!=limit)throw new AssertionError(name+" bufferData");
        // GL must snapshot the upload before callers reuse a mutable input buffer.
        if(!b.isReadOnly()&&b.hasRemaining()){byte old=b.get(position);b.put(position,(byte)(old^127));if(!bufferEquals(expected,0))throw new AssertionError(name+" GPU alias");b.put(position,old);}
        ByteBuffer storage=ByteBuffer.allocate(expected.length+19);GL15.glBufferData(TARGET,storage,USAGE);
        GL15.glBufferSubData(TARGET,11,b);
        if(!bufferEquals(expected,11)||b.position()!=position||b.limit()!=limit)throw new AssertionError(name+" bufferSubData");
        if(error()!=0)throw new AssertionError(name+" GL error");checks++;
    }
    private static double time(ByteBuffer b,boolean baseline,boolean sub,int count){
        long start=System.nanoTime();
        for(int n=0;n<count;n++){
            if(baseline){if(sub)GL15Baseline.glBufferSubData(TARGET,0,b);else GL15Baseline.glBufferData(TARGET,b,USAGE);}
            else{if(sub)GL15.glBufferSubData(TARGET,0,b);else GL15.glBufferData(TARGET,b,USAGE);}
        }
        return (System.nanoTime()-start)/1e6;
    }
    public static void main(String[] args){
        BrowserBridge.createContext(64,64);int id=GL15.glGenBuffers();GL15.glBindBuffer(TARGET,id);
        try{
            for(int kind=0;kind<4;kind++)for(int shift=0;shift<4;shift++){
                ByteBuffer b=kind==1?ByteBuffer.allocateDirect(96):ByteBuffer.allocate(96);
                for(int n=0;n<96;n++)b.put(n,(byte)(n*17-113));
                if(kind>=2){b.position(7).limit(83);b=b.slice();if(kind==3)b=b.asReadOnlyBuffer();}
                b.position(shift+3).limit(47);verify("kind="+kind+" shift="+shift,b);
            }
            verify("empty",ByteBuffer.allocate(8).position(8));
            IntBuffer ints=IntBuffer.wrap(new int[]{1,0x12345678,-1,7});ints.position(1).limit(3);GL15.glBufferData(TARGET,ints,USAGE);
            if(!bufferEquals(new byte[]{0x78,0x56,0x34,0x12,-1,-1,-1,-1},0)||ints.position()!=1||ints.limit()!=3||error()!=0)throw new AssertionError("IntBuffer fallback");
            report("GPU correctness PASS: "+checks+" heap/direct/sliced/readonly/empty data+subData cases; positions/limits and snapshot semantics; IntBuffer fallback");
            ByteBuffer b=ByteBuffer.allocate(65536);for(int n=0;n<b.capacity();n++)b.put(n,(byte)n);b.position(1024).limit(49152);
            double[] oldMs=new double[6],newMs=new double[6];
            for(boolean sub:new boolean[]{false,true}){
                GL15.glBufferData(TARGET,ByteBuffer.allocate(65536),USAGE);time(b,true,sub,8);time(b,false,sub,8);
                for(int r=0;r<6;r++){
                    if((r&1)==0){oldMs[r]=time(b,true,sub,128);newMs[r]=time(b,false,sub,128);}else{newMs[r]=time(b,false,sub,128);oldMs[r]=time(b,true,sub,128);}
                    report((sub?"subData":"data")+" round"+r+": baseline="+oldMs[r]+"ms range="+newMs[r]+"ms");
                }
                report((sub?"SUBDATA":"DATA")+" baseline="+Arrays.toString(oldMs)+" range="+Arrays.toString(newMs));
            }
            if(error()!=0)throw new AssertionError("Benchmark GL error");report("DONE GL=0; payload 48128 bytes x128 each sample");
        }finally{GL15.glDeleteBuffers(id);BrowserBridge.destroyContext();}
    }
}
