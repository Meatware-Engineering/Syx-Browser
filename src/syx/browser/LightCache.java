package syx.browser;
import java.util.Arrays;
import settlement.thing.pointlight.LOS;
import settlement.thing.pointlight.LOS_MAP;
public final class LightCache {
 // The tracer resets this cache for every light, so map changes are seen on the next calculation.
 private static final int[] stamp=new int[4096], xs=new int[4096], ys=new int[4096];
 private static final LOS[] values=new LOS[4096];
 private static int generation;
 public static void reset() { if(++generation==0) { Arrays.fill(stamp,0); generation=1; } }
 public static LOS get(LOS_MAP map,int x,int y) {
  int i=((x&63)<<6)|(y&63);
  if(stamp[i]==generation && xs[i]==x && ys[i]==y) return values[i];
  LOS value=map.get(x,y); stamp[i]=generation; xs[i]=x; ys[i]=y; values[i]=value; return value;
 }
}
