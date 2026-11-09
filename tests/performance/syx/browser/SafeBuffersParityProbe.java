package syx.browser;
import java.nio.*;
import java.util.*;
public final class SafeBuffersParityProbe {
    static int size(int operation){return new int[]{2,2,4,8,4,8}[operation];}
    static void put(ByteBuffer b,int op,boolean absolute,int index,long bits,boolean candidate){
        if(candidate){
            switch(op){
                case 0 -> {if(absolute)SafeBuffers.putShort(b,index,(short)bits);else SafeBuffers.putShort(b,(short)bits);}
                case 1 -> {if(absolute)SafeBuffers.putChar(b,index,(char)bits);else SafeBuffers.putChar(b,(char)bits);}
                case 2 -> {if(absolute)SafeBuffers.putInt(b,index,(int)bits);else SafeBuffers.putInt(b,(int)bits);}
                case 3 -> {if(absolute)SafeBuffers.putLong(b,index,bits);else SafeBuffers.putLong(b,bits);}
                case 4 -> {if(absolute)SafeBuffers.putFloat(b,index,Float.intBitsToFloat((int)bits));else SafeBuffers.putFloat(b,Float.intBitsToFloat((int)bits));}
                case 5 -> {if(absolute)SafeBuffers.putDouble(b,index,Double.longBitsToDouble(bits));else SafeBuffers.putDouble(b,Double.longBitsToDouble(bits));}
            }
        }else{
            switch(op){
                case 0 -> {if(absolute)b.putShort(index,(short)bits);else b.putShort((short)bits);}
                case 1 -> {if(absolute)b.putChar(index,(char)bits);else b.putChar((char)bits);}
                case 2 -> {if(absolute)b.putInt(index,(int)bits);else b.putInt((int)bits);}
                case 3 -> {if(absolute)b.putLong(index,bits);else b.putLong(bits);}
                case 4 -> {if(absolute)b.putFloat(index,Float.intBitsToFloat((int)bits));else b.putFloat(Float.intBitsToFloat((int)bits));}
                case 5 -> {if(absolute)b.putDouble(index,Double.longBitsToDouble(bits));else b.putDouble(Double.longBitsToDouble(bits));}
            }
        }
    }
    static byte[] bytes(ByteBuffer b){ByteBuffer copy=b.duplicate();copy.clear();byte[] data=new byte[copy.remaining()];copy.get(data);return data;}
    static ByteBuffer buffer(int kind,ByteOrder order){
        ByteBuffer b=kind==1?ByteBuffer.allocateDirect(48):ByteBuffer.allocate(48);
        for(int i=0;i<b.capacity();i++)b.put(i,(byte)(i+31));
        if(kind==2||kind==3){b.position(7);b.limit(39);b=b.slice();}
        if(kind==3)b=b.asReadOnlyBuffer();
        return b.order(order);
    }
    static Class<?> outcome(ByteBuffer b,int op,boolean abs,int index,long bits,boolean candidate){try{put(b,op,abs,index,bits,candidate);return null;}catch(RuntimeException error){return error.getClass();}}
    public static void main(String[] args){
        Random random=new Random(7919);int cases=0;
        for(int kind=0;kind<4;kind++)for(ByteOrder order:new ByteOrder[]{ByteOrder.BIG_ENDIAN,ByteOrder.LITTLE_ENDIAN})for(int op=0;op<6;op++)for(boolean abs:new boolean[]{false,true})for(int trial=0;trial<24;trial++){
            ByteBuffer expected=buffer(kind,order),actual=buffer(kind,order);
            int limit=24, position=(trial%3==0)?limit-size(op)+1:6,index=switch(trial%5){case 0->-1;case 1->limit-size(op)+1;case 2->Integer.MAX_VALUE;default->9;};
            expected.limit(limit).position(position);actual.limit(limit).position(position);
            long bits=switch(trial%6){case 0->0x7ff812347fc01234L;case 1->0x8000000080000000L;case 2->Long.MIN_VALUE;case 3->Long.MAX_VALUE;default->random.nextLong();};
            Class<?> a=outcome(expected,op,abs,index,bits,false),b=outcome(actual,op,abs,index,bits,true);
            if(a!=b||expected.position()!=actual.position()||expected.limit()!=actual.limit()||!Arrays.equals(bytes(expected),bytes(actual)))throw new AssertionError("Mismatch kind="+kind+" order="+order+" op="+op+" abs="+abs+" trial="+trial+" exceptions="+a+"/"+b);
            cases++;
        }
        ByteBuffer marked=ByteBuffer.allocate(32);marked.position(3).mark().position(6);SafeBuffers.putLong(marked,123);marked.reset();if(marked.position()!=3)throw new AssertionError("mark lost");
        System.out.println("SafeBuffers JVM parity: "+cases+" cases, heap/direct/slices/readonly/endian/bounds/raw bits/mark: PASS");
    }
}
