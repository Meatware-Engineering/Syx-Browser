import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.zip.ZipFile;
import jdk.internal.org.objectweb.asm.*;

public class ByteBufferPatcher {
    private static final Set<String> METHODS = Set.of("putShort", "putChar", "putInt", "putLong", "putFloat", "putDouble");
    public static void main(String[] args) throws Exception {
        int patched = 0;
        int[] lightCacheHooks = {0, 0};
        int[] languageHooks = {0};
        int[] fontHooks = {0};
        try (ZipFile jar = new ZipFile(args[0])) {
            var entries = jar.entries();
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                String name = entry.getName();
                if (!name.endsWith(".class") || name.startsWith("META-INF/") || name.startsWith("org/") || name.startsWith("com/") || name.startsWith("club/")) continue;
                Path target = Path.of(args[1], name);
                if (Files.exists(target)) continue;
                try (InputStream input = jar.getInputStream(entry)) {
                    ClassReader reader = new ClassReader(input);
                    ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                    boolean[] changed = {false};
                    reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                        public MethodVisitor visitMethod(int access, String methodName, String desc, String signature, String[] exceptions) {
                            MethodVisitor out = super.visitMethod(access, methodName, desc, signature, exceptions);
                            return new MethodVisitor(Opcodes.ASM8, out) {
                                boolean dataPath = false, beforeDataAdd = false; int dataConstants = 0;
                                public void visitCode() {
                                    super.visitCode();
                                    if (name.equals("settlement/thing/pointlight/PointRayTracer.class") && methodName.equals("init") && desc.equals("(II)V")) {
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/LightCache", "reset", "()V", false);
                                        changed[0] = true;
                                        lightCacheHooks[0]++;
                                    }
                                }
                                public void visitLdcInsn(Object value) {
                                    if (name.equals("init/paths/PATHS.class") && methodName.equals("<init>") && "data".equals(value)) dataPath = ++dataConstants == 2;
                                    // Browser world generation can legitimately block the updater longer than desktop.
                                    if (name.equals("snake2d/CORE.class") && methodName.equals("start") && Long.valueOf(5000L).equals(value)) {
                                        changed[0] = true;
                                        super.visitLdcInsn(120000L);
                                    } else super.visitLdcInsn(value);
                                }
                                public void visitMethodInsn(int opcode, String owner, String method, String descriptor, boolean itf) {
                                    if (name.equals("init/paths/PATHS.class") && methodName.equals("<init>") && dataPath && owner.equals("init/paths/Util") && method.equals("checkHard")) {
                                        beforeDataAdd = true;
                                    }
                                    if (name.equals("init/paths/PATHS.class") && methodName.equals("<init>") && beforeDataAdd && owner.equals("snake2d/util/sets/LinkedList") && method.equals("add")) {
                                        super.visitVarInsn(Opcodes.ALOAD, 7);
                                        super.visitVarInsn(Opcodes.ALOAD, 2);
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/BrowserFonts", "addEnglishCyrillic", "(Lsnake2d/util/sets/LinkedList;Ljava/lang/String;)V", false);
                                        changed[0] = true; fontHooks[0]++; beforeDataAdd = false;
                                    }
                                    if (name.equals("init/MainProcess.class") && methodName.equals("main") && owner.equals("launcher/LSettings$SString") && method.equals("get") && descriptor.equals("()Ljava/lang/String;")) {
                                        super.visitMethodInsn(opcode, owner, method, descriptor, itf);
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/BrowserLanguage", "resolve", "(Ljava/lang/String;)Ljava/lang/String;", false);
                                        changed[0] = true;
                                        languageHooks[0]++;
                                    } else if (name.equals("settlement/thing/pointlight/PointRayTracer.class") && opcode == Opcodes.INVOKEVIRTUAL && owner.equals("settlement/thing/pointlight/LOS_MAP") && method.equals("get") && descriptor.equals("(II)Lsettlement/thing/pointlight/LOS;")) {
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/LightCache", "get", "(Lsettlement/thing/pointlight/LOS_MAP;II)Lsettlement/thing/pointlight/LOS;", false);
                                        changed[0] = true;
                                        lightCacheHooks[1]++;
                                    } else if (opcode == Opcodes.INVOKEVIRTUAL && owner.equals("java/nio/ByteBuffer") && METHODS.contains(method) && descriptor.endsWith(")Ljava/nio/ByteBuffer;")) {
                                        changed[0] = true;
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/SafeBuffers", method, "(Ljava/nio/ByteBuffer;" + descriptor.substring(1), false);
                                    } else if (name.equals("snake2d/CORE.class") && methodName.equals("start") && owner.equals("snake2d/Updater") && method.equals("getStackTrace") && descriptor.equals("()[Ljava/lang/StackTraceElement;")) {
                                        changed[0] = true;
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/BrowserCompat", "stackTrace", "(Ljava/lang/Thread;)[Ljava/lang/StackTraceElement;", false);
                                    } else if ((name.equals("snake2d/SlaveThread.class") || name.equals("snake2d/CORE$GlJob$1.class")) && owner.equals("java/lang/Thread") && method.equals("getStackTrace") && descriptor.equals("()[Ljava/lang/StackTraceElement;")) {
                                        changed[0] = true;
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC, "syx/browser/BrowserCompat", "stackTrace", "(Ljava/lang/Thread;)[Ljava/lang/StackTraceElement;", false);
                                    } else super.visitMethodInsn(opcode, owner, method, descriptor, itf);
                                }
                            };
                        }
                    }, 0);
                    if (changed[0]) {
                        Files.createDirectories(target.getParent());
                        Files.write(target, writer.toByteArray());
                        patched++;
                    }
                }
            }
        }
        if (lightCacheHooks[0] != 1 || lightCacheHooks[1] != 4) throw new IllegalStateException("Unsupported lighting implementation");
        if (fontHooks[0] != 1) throw new IllegalStateException("Unsupported font implementation: " + fontHooks[0]);
        if (languageHooks[0] != 1) throw new IllegalStateException("Unsupported language implementation");
        System.out.println("Patched " + patched + " application classes for browser compatibility");
    }
}
