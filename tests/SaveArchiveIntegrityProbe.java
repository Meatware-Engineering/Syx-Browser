import java.io.IOException;
import java.nio.file.*;
import java.util.Arrays;
import java.util.zip.*;
import syx.browser.SaveArchive;
public final class SaveArchiveIntegrityProbe {
    private static void reject(Path archive, Path destination) throws Exception {
        try { SaveArchive.restore(destination.toString(),archive.toString());throw new AssertionError("Invalid ZIP accepted: " + archive.getFileName()); }
        catch(IOException expected) {}
        if(Files.exists(destination))throw new AssertionError("Invalid ZIP wrote a destination file");
    }
    public static void main(String[] args) throws Exception {
        Path test=Path.of(args[0]), good=test.resolve("good.zip"), bad=test.resolve("truncated.zip"), destination=test.resolve("restored");
        try (ZipOutputStream zip=new ZipOutputStream(Files.newOutputStream(good))) {
            for (String name:new String[]{"saves/first.save","saves/second.save"}) {
                byte[] bytes=name.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                CRC32 crc=new CRC32();crc.update(bytes);
                ZipEntry entry=new ZipEntry(name);entry.setMethod(ZipEntry.STORED);entry.setSize(bytes.length);entry.setCrc(crc.getValue());
                zip.putNextEntry(entry);zip.write(bytes);zip.closeEntry();
            }
        }
        byte[] bytes=Files.readAllBytes(good);int second=-1;
        for(int i=4;i<bytes.length-3;i++)if(bytes[i]==80 && bytes[i+1]==75 && bytes[i+2]==3 && bytes[i+3]==4){second=i;break;}
        if(second<0)throw new AssertionError("Fixture missing second local entry");
        Files.write(bad,Arrays.copyOf(bytes,second));
        reject(bad,destination);
        byte[] corrupt=bytes.clone();
        int data=30+(bytes[26]&255)+((bytes[27]&255)<<8)+(bytes[28]&255)+((bytes[29]&255)<<8);
        corrupt[data]^=1;Path crc=test.resolve("crc.zip");Files.write(crc,corrupt);
        reject(crc,destination);
        try(var staging=Files.list(Path.of(System.getProperty("syx.test.files")))) {
            if(staging.findAny().isPresent())throw new AssertionError("Failed import left staging files");
        }
        String result=SaveArchive.restore(destination.toString(),good.toString());
        if(!result.equals("Восстановлено: 2; пропущено существующих: 0"))throw new AssertionError(result);
        System.out.println("Save archive integrity: truncated ZIP and bad CRC rejected before writes, staging cleaned; valid ZIP restored: PASS");
    }
}
