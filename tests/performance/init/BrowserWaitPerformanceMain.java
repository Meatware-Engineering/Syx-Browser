package init;
import snake2d.CORE;
import snake2d.CoreStats;

// Diagnostic launcher only: times the updater's existing swapAndPoll call without changing it.
public final class BrowserWaitPerformanceMain {
    private static volatile boolean running = true;
    private static long waitCount, waitNanos, waitMax;
    private static native void report(double update, double updateMax, double render, double renderMax,
        double flush, double flushMax, double swap, double swapMax, double wait, double waitMax, long waitCount);
    private static double ms(double value) { return value * 0.16666666; }
    public static void timedSwapAndPoll() {
        long start = System.nanoTime();
        try { CORE.swapAndPoll(); }
        finally {
            long elapsed = System.nanoTime() - start;
            synchronized (BrowserWaitPerformanceMain.class) {
                waitCount++; waitNanos += elapsed; waitMax = Math.max(waitMax, elapsed);
            }
        }
    }
    public static void main(String[] args) throws Exception {
        Thread observer = new Thread(() -> {
            try {
                while (running) {
                    Thread.sleep(2000);
                    if (!running) break;
                    long count, nanos, maximum;
                    synchronized (BrowserWaitPerformanceMain.class) {
                        count=waitCount; nanos=waitNanos; maximum=waitMax;
                        waitCount=waitNanos=waitMax=0;
                    }
                    report(ms(CoreStats.updatePercentage.ave), ms(CoreStats.updatePercentage.max),
                        ms(CoreStats.renderPercentage.ave), ms(CoreStats.renderPercentage.max),
                        ms(CoreStats.coreFlush.ave), ms(CoreStats.coreFlush.max),
                        ms(CoreStats.swapPercentage.ave), ms(CoreStats.swapPercentage.max),
                        count==0 ? Double.NaN : nanos/(count*1000000.0), maximum/1000000.0, count);
                }
            } catch (InterruptedException expected) { Thread.currentThread().interrupt(); }
            catch (Throwable error) { System.err.println("Browser wait metrics stopped: " + error); }
        }, "Browser wait metrics");
        observer.setDaemon(true); observer.start();
        try { MainProcess.main(args); }
        finally { running=false; observer.interrupt(); }
    }
}
