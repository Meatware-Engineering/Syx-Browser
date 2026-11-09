package syx.browser;

public final class BrowserLanguage {
    public static String resolve(String saved) {
        String choice = System.getProperty("syx.browser.language");
        return choice == null ? saved : choice;
    }
}
