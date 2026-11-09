package syx.browser;
import java.nio.*;
import java.util.Arrays;
public final class BufferPerformanceProbe {
    private static volatile int checksum;
    private static native void report(String text);
    private static void write(ByteBuffer b, boolean baseline, int count) {
        for (int n=0;n<count;n++) {
            b.clear();
            for(int i=0;i<512;i++) {
                if(baseline) {
                    SafeBuffersBaseline.putFloat(b,i+0.25f);SafeBuffersBaseline.putInt(b,i*7919);
                    SafeBuffersBaseline.putShort(b,(short)i);SafeBuffersBaseline.putLong(b,0x123456789abcdef0L+i);
                } else {
                    SafeBuffers.putFloat(b,i+0.25f);SafeBuffers.putInt(b,i*7919);
                    SafeBuffers.putShort(b,(short)i);SafeBuffers.putLong(b,0x123456789abcdef0L+i);
                }
            }
            checksum+=b.get(11);
        }
    }
    private static double time(ByteBuffer b,boolean baseline,int count) {
        long start=System.nanoTime();write(b,baseline,count);return (System.nanoTime()-start)/1e6;
    }
    private static String samples(double[] v){return Arrays.toString(v);}
    public static void main(String[] args) {
        boolean jvm=args.length>0;
        ByteBuffer baseline=ByteBuffer.allocate(16384).order(ByteOrder.LITTLE_ENDIAN),candidate=ByteBuffer.allocate(16384).order(ByteOrder.LITTLE_ENDIAN);
        write(baseline,true,1);write(candidate,false,1);
        if(!Arrays.equals(baseline.array(),candidate.array()))throw new AssertionError("Synthetic vertex bytes differ");
        for(ByteOrder order:new ByteOrder[]{ByteOrder.LITTLE_ENDIAN,ByteOrder.BIG_ENDIAN}){
            ByteBuffer a=ByteBuffer.allocate(48),b=ByteBuffer.allocate(48);a.position(7).limit(39);b.position(7).limit(39);a=a.slice().order(order);b=b.slice().order(order);
            SafeBuffersBaseline.putInt(a,3,0x12345678);SafeBuffers.putInt(b,3,0x12345678);
            SafeBuffersBaseline.putChar(a,10,'Ж');SafeBuffers.putChar(b,10,'Ж');
            SafeBuffersBaseline.putDouble(a,16,Double.longBitsToDouble(0x7ff8123456789abcL));SafeBuffers.putDouble(b,16,Double.longBitsToDouble(0x7ff8123456789abcL));
            for(int i=0;i<32;i++)if(a.get(i)!=b.get(i))throw new AssertionError("Slice/endian/raw-double bytes differ at "+i);
        }
        if(jvm)System.out.println("Vertex bytes equal");else report("Vertex bytes equal; warming both implementations…");
        write(baseline,true,64);write(candidate,false,64);
        double[] oldMs=new double[6],newMs=new double[6];
        for(int round=0;round<6;round++){
            if((round&1)==0){oldMs[round]=time(baseline,true,240);newMs[round]=time(candidate,false,240);}
            else{newMs[round]=time(candidate,false,240);oldMs[round]=time(baseline,true,240);}
            String s="Round "+round+": baseline="+oldMs[round]+" ms; candidate="+newMs[round]+" ms";
            if(jvm)System.out.println(s);else report(s);
        }
        String s="DONE baseline_ms="+samples(oldMs)+" candidate_ms="+samples(newMs)+" checksum="+checksum;
        if(jvm)System.out.println(s);else report(s);
    }
}
