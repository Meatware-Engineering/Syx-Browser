import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Rewrites exactly one existing call in a local diagnostic copy, leaving the normal game JAR intact.
public final class CoreWaitPatcher {
    public static void main(String[] args) throws Exception {
        byte[] original;
        try (JarFile game = new JarFile(args[0])) {
            original = game.getInputStream(game.getJarEntry("snake2d/Updater.class")).readAllBytes();
        }
        ClassReader reader = new ClassReader(original);
        ClassWriter writer = new ClassWriter(0);
        int[] replacements = {0};
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            @Override public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
                MethodVisitor delegate = super.visitMethod(access, name, descriptor, signature, exceptions);
                if (!name.equals("run") || !descriptor.equals("()V")) return delegate;
                return new MethodVisitor(Opcodes.ASM8, delegate) {
                    @Override public void visitMethodInsn(int opcode, String owner, String method, String desc, boolean isInterface) {
                        if (opcode==Opcodes.INVOKESTATIC && owner.equals("snake2d/CORE") && method.equals("swapAndPoll") && desc.equals("()V")) {
                            replacements[0]++;
                            owner="init/BrowserWaitPerformanceMain"; method="timedSwapAndPoll";
                        }
                        super.visitMethodInsn(opcode, owner, method, desc, isInterface);
                    }
                };
            }
        }, 0);
        if (replacements[0]!=1) throw new IllegalStateException("Expected one updater swapAndPoll call, found "+replacements[0]);
        Path output=Path.of(args[1],"snake2d/Updater.class");
        Files.createDirectories(output.getParent()); Files.write(output,writer.toByteArray());
        System.out.println("Diagnostic updater: exactly one swapAndPoll call wrapped");
    }
}
