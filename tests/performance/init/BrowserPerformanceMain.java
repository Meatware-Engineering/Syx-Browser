package init;
import snake2d.CoreStats;

// Opt-in observer of the installed game's existing timers; never changes their values.
public final class BrowserPerformanceMain {
    private static volatile boolean running = true;
    private static native void report(double update, double render, double poll, double flush, double finish, double sleep, double sound, double usedHeapKiB);
    private static double milliseconds(CoreStats.Value value) {
        // CoreStats.Value.set normalizes nanoseconds against a 16,666,666 ns reference frame.
        return value.ave * 0.16666666;
    }
    public static void main(String[] args) throws Exception {
        Thread observer = new Thread(() -> {
            try {
                while (running) {
                    Thread.sleep(2000);
                    if (running) report(milliseconds(CoreStats.updatePercentage), milliseconds(CoreStats.renderPercentage),
                        milliseconds(CoreStats.corePoll), milliseconds(CoreStats.coreFlush), milliseconds(CoreStats.coreFinish),
                        milliseconds(CoreStats.coreSleep), milliseconds(CoreStats.coreSound), CoreStats.usedHeap.ave);
                }
            } catch (InterruptedException expected) {
                Thread.currentThread().interrupt();
            } catch (Throwable error) {
                System.err.println("Browser core metrics stopped: " + error);
            }
        }, "Browser core metrics");
        observer.setDaemon(true);
        observer.start();
        try { MainProcess.main(args); }
        finally { running = false; observer.interrupt(); }
    }
}
