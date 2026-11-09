#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SYX_JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin
SYX_OBSERVER_BUILD=$(mktemp -d)
trap 'rm -rf "$SYX_OBSERVER_BUILD"' EXIT HUP INT TERM
python3 - "$SYX_OBSERVER_BUILD" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1]);(root/'init').mkdir();(root/'snake2d').mkdir()
s=Path('tests/performance/init/BrowserPerformanceMain.java').read_text().replace('Thread.sleep(2000)','Thread.sleep(2)')
old='private static native void report(double update, double render, double poll, double flush, double finish, double sleep, double sound, double usedHeapKiB);'
assert s.count(old)==1
s=s.replace(old,'''static int testReports; static boolean testThrowReports; static double[] testValues;
    private static void report(double update, double render, double poll, double flush, double finish, double sleep, double sound, double usedHeapKiB) {
        testReports++;testValues=new double[]{update,render,poll,flush,finish,sleep,sound,usedHeapKiB};
        if(testThrowReports && testReports==2)throw new IllegalStateException("synthetic observer boundary failure");
    }''')
(root/'init/BrowserPerformanceMain.java').write_text(s)
fields=['updatePercentage','renderPercentage','corePoll','coreFlush','coreFinish','coreSleep','coreSound','usedHeap']
(root/'snake2d/CoreStats.java').write_text('package snake2d; public class CoreStats { public static class Value {public double ave=600;} '+''.join('public static final Value '+name+'=new Value();' for name in fields)+'}')
(root/'init/MainProcess.java').write_text('package init; class MainProcess {static boolean completed;static String[] received;public static void main(String[] args)throws Exception{received=args;Thread.sleep(60);completed=true;}}')
(root/'init/ObserverCheck.java').write_text('''package init;
public class ObserverCheck {
 public static void main(String[] args)throws Exception {
  BrowserPerformanceMain.testThrowReports=args.length>0;
  String[] passed={"synthetic"};BrowserPerformanceMain.main(passed);
  if(!MainProcess.completed || MainProcess.received!=passed || BrowserPerformanceMain.testReports<2)throw new AssertionError("game delegation/reports");
  double[] values=BrowserPerformanceMain.testValues;
  for(int i=0;i<7;i++)if(Math.abs(values[i]-99.999996)>0.000001)throw new AssertionError("time units");
  if(values[7]!=600 || snake2d.CoreStats.corePoll.ave!=600)throw new AssertionError("heap/read-only");
  for(Thread thread:Thread.getAllStackTraces().keySet())if(thread.getName().equals("Browser core metrics")){thread.join(200);if(thread.isAlive())throw new AssertionError("observer retained");}
  if(BrowserPerformanceMain.testThrowReports && BrowserPerformanceMain.testReports!=2)throw new AssertionError("failure isolation");
  System.out.println("Core observer: read-only timer conversion, original main arguments, "+(args.length>0?"native failure isolation":"normal shutdown")+": PASS");
 }
}''')
PY
"$SYX_JAVA_BIN/javac" --release 17 -d "$SYX_OBSERVER_BUILD/classes" "$SYX_OBSERVER_BUILD/init/BrowserPerformanceMain.java" "$SYX_OBSERVER_BUILD/init/MainProcess.java" "$SYX_OBSERVER_BUILD/init/ObserverCheck.java" "$SYX_OBSERVER_BUILD/snake2d/CoreStats.java"
"$SYX_JAVA_BIN/java" -cp "$SYX_OBSERVER_BUILD/classes" init.ObserverCheck
"$SYX_JAVA_BIN/java" -cp "$SYX_OBSERVER_BUILD/classes" init.ObserverCheck throw
sh tests/build-core-performance-probe.sh
