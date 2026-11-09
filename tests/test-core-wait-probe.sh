#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SYX_JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin
SYX_WAIT_TEST=$(mktemp -d)
trap 'rm -rf "$SYX_WAIT_TEST"' EXIT HUP INT TERM
python3 - "$SYX_WAIT_TEST" <<'PY'
from pathlib import Path
import sys
r=Path(sys.argv[1]); (r/'init').mkdir(); (r/'snake2d').mkdir()
s=Path('tests/performance/init/BrowserWaitPerformanceMain.java').read_text().replace('Thread.sleep(2000)','Thread.sleep(2)')
a=s.index('    private static native void report(');b=s.index(';',a)+1
s=s[:a]+'''    static int reports; static boolean failReport; static double[] values; static long observedCalls; static boolean sawPositiveWait;
    private static void report(double u,double um,double r,double rm,double f,double fm,double s,double sm,double w,double wm,long c) {
        reports++;values=new double[]{u,um,r,rm,f,fm,s,sm,w,wm,c};
        observedCalls+=c;
        if(c>0){if(w<0 || wm<w)throw new AssertionError("wait aggregate");if(wm>=4)sawPositiveWait=true;}
        else if(!Double.isNaN(w) || wm!=0)throw new AssertionError("empty interval");
        if(failReport && reports==2)throw new IllegalStateException("synthetic report failure");
    }'''+s[b:]
(r/'init/BrowserWaitPerformanceMain.java').write_text(s)
(r/'snake2d/CoreStats.java').write_text('package snake2d; public class CoreStats {public static class Value { public double ave=600,max=1200;} public static final Value updatePercentage=new Value(),renderPercentage=new Value(),coreFlush=new Value(),swapPercentage=new Value();}')
(r/'snake2d/CORE.java').write_text('package snake2d; public class CORE {public static int calls; public static final RuntimeException error=new RuntimeException("original");public static boolean fail;public static void swapAndPoll(){calls++;if(fail)throw error; try{Thread.sleep(5);}catch(InterruptedException e){Thread.currentThread().interrupt();}}}')
(r/'snake2d/Updater.java').write_text('package snake2d; public class Updater implements Runnable {public void run(){CORE.swapAndPoll();} public static void main(String[] args)throws Exception{runCheck();} public static void runCheck()throws Exception{int before=CORE.calls;new Updater().run();if(CORE.calls!=before+1)throw new AssertionError("delegation");CORE.fail=true;try{new Updater().run();throw new AssertionError("missing error");}catch(RuntimeException e){if(e!=CORE.error)throw new AssertionError("error identity");}finally{CORE.fail=false;}}}')
(r/'init/MainProcess.java').write_text('package init; class MainProcess {static String[] received; public static void main(String[] args)throws Exception{received=args;for(int i=0;i<12;i++){new snake2d.Updater().run();Thread.sleep(2);}}}')
(r/'init/WaitCheck.java').write_text('''package init;
public class WaitCheck {public static void main(String[] args)throws Exception {
 snake2d.Updater.runCheck();
 BrowserWaitPerformanceMain.failReport=args.length>0;
 String[] passed={"synthetic"};BrowserWaitPerformanceMain.main(passed);
 if(MainProcess.received!=passed || snake2d.CORE.calls!=14 || BrowserWaitPerformanceMain.reports<2)throw new AssertionError("original args and calls");
 double[] v=BrowserWaitPerformanceMain.values;
 for(int i=0;i<8;i++)if(Math.abs(v[i]-(i%2==0?99.999996:199.999992))>0.000001)throw new AssertionError("existing units");
 if(snake2d.CoreStats.updatePercentage.ave!=600 || snake2d.CoreStats.swapPercentage.max!=1200)throw new AssertionError("changed stats");
 if(BrowserWaitPerformanceMain.failReport && BrowserWaitPerformanceMain.reports!=2)throw new AssertionError("failure isolation");
 for(Thread t:Thread.getAllStackTraces().keySet())if(t.getName().equals("Browser wait metrics")){t.join(200);if(t.isAlive())throw new AssertionError("observer retained");}
 java.lang.reflect.Field pending=BrowserWaitPerformanceMain.class.getDeclaredField("waitCount");pending.setAccessible(true);
 if(BrowserWaitPerformanceMain.observedCalls+pending.getLong(null)!=snake2d.CORE.calls || !BrowserWaitPerformanceMain.sawPositiveWait)throw new AssertionError("wait count/reset/timing");
 System.out.println("Wait probe: exact call/error/args, units, read-only stats, observer shutdown/failure isolation: PASS");
}}''')
PY
mkdir "$SYX_WAIT_TEST/classes" "$SYX_WAIT_TEST/patched" "$SYX_WAIT_TEST/patcher"
"$SYX_JAVA_BIN/javac" --release 17 -d "$SYX_WAIT_TEST/classes" "$SYX_WAIT_TEST"/init/*.java "$SYX_WAIT_TEST"/snake2d/*.java
"$SYX_JAVA_BIN/jar" cf "$SYX_WAIT_TEST/fake-game.jar" -C "$SYX_WAIT_TEST/classes" snake2d/Updater.class
"$SYX_JAVA_BIN/javac" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -d "$SYX_WAIT_TEST/patcher" tests/performance/CoreWaitPatcher.java
"$SYX_JAVA_BIN/java" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -cp "$SYX_WAIT_TEST/patcher" CoreWaitPatcher "$SYX_WAIT_TEST/fake-game.jar" "$SYX_WAIT_TEST/patched"
"$SYX_JAVA_BIN/java" -cp "$SYX_WAIT_TEST/patched:$SYX_WAIT_TEST/classes" init.WaitCheck
"$SYX_JAVA_BIN/java" -cp "$SYX_WAIT_TEST/patched:$SYX_WAIT_TEST/classes" init.WaitCheck throw
# Refuse unexpected engine versions before writing any diagnostic class.
for SYX_CALL_COUNT in 0 2; do
 mkdir "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT"
 python3 - "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT" "$SYX_CALL_COUNT" <<'PYCASE'
from pathlib import Path
import sys
p=Path(sys.argv[1]);p.joinpath('Updater.java').write_text('package snake2d;public class Updater {public void run(){'+'CORE.swapAndPoll();'*int(sys.argv[2])+'}}')
PYCASE
 "$SYX_JAVA_BIN/javac" --release 17 -cp "$SYX_WAIT_TEST/classes" -d "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT" "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT/Updater.java"
 "$SYX_JAVA_BIN/jar" cf "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT.jar" -C "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT" snake2d/Updater.class
 if "$SYX_JAVA_BIN/java" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -cp "$SYX_WAIT_TEST/patcher" CoreWaitPatcher "$SYX_WAIT_TEST/case-$SYX_CALL_COUNT.jar" "$SYX_WAIT_TEST/rejected-$SYX_CALL_COUNT" >"$SYX_WAIT_TEST/rejection-$SYX_CALL_COUNT.txt" 2>&1; then
  echo "Expected patch refusal" >&2; exit 1
 fi
 test ! -e "$SYX_WAIT_TEST/rejected-$SYX_CALL_COUNT/snake2d/Updater.class"
 done
printf '%s\n' 'Wait patch guard: zero/two calls rejected without output: PASS'
