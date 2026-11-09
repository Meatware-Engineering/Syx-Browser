import syx.browser.LightCache;
import settlement.thing.pointlight.*;
public class LightCacheTest {
 static class Item implements LOS {}
 public static void main(String[] args) {
  LOS_MAP m=new LOS_MAP(); LOS a=new Item(), b=new Item(); m.value=a;
  LightCache.reset();
  if(LightCache.get(m,-1,7)!=a || LightCache.get(m,-1,7)!=a || m.calls!=1) throw new AssertionError("hit or negative coordinates");
  m.value=b; if(LightCache.get(m,63,7)!=b || m.calls!=2) throw new AssertionError("hash collision");
  m.value=a; if(LightCache.get(m,-1,7)!=a || m.calls!=3) throw new AssertionError("collision overwrite");
  m.value=b; LightCache.reset(); if(LightCache.get(m,-1,7)!=b || m.calls!=4) throw new AssertionError("stale after reset");
  System.out.println("Light cache collision and reset tests: PASS");
 }
}
