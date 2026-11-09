package org.lwjgl.openal;

import java.util.Collections;
import java.util.List;

public final class ALUtil {
    // shortcut: no audio device until the Web Audio bridge is implemented.
    public static List<String> getStringList(long device, int parameter) { return Collections.emptyList(); }
}
