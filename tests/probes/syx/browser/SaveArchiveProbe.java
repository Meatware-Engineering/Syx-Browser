package syx.browser;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
public final class SaveArchiveProbe {
 public static void main(String[] args) throws Exception {
  Path test=Files.createTempDirectory(Path.of("/files"),"syx-archive-test-");
  try {
   Path src=test.resolve("src"),dst=test.resolve("dst"),zip=test.resolve("backup.zip");
   Files.createDirectories(src.resolve("saves"));Files.createDirectories(src.resolve("profile"));
   byte[] payload=new byte[2*1024*1024+7];int seed=0x13579bdf;
   for(int i=0;i<payload.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;payload[i]=(byte)seed;}
   Files.write(src.resolve("saves/world.save"),payload);Files.writeString(src.resolve("profile/settings.txt"),"original");
   if(SaveArchive.backup(src.toString(),zip.toString())!=2)throw new AssertionError("Backup count");
   byte[] archive=Files.readAllBytes(zip);
   int central=-1;for(int i=0;i<archive.length-3;i++)if(archive[i]==80 && archive[i+1]==75 && archive[i+2]==1 && archive[i+3]==2){central=i;break;}
   if(central<0)throw new AssertionError("Missing fixture central directory");
   Path truncated=test.resolve("truncated.zip"),invalidDst=test.resolve("invalid-dst");Files.write(truncated,Arrays.copyOf(archive,central));
   try{SaveArchive.restore(invalidDst.toString(),truncated.toString());throw new AssertionError("Truncated archive accepted");}catch(java.io.IOException expected){}
   if(Files.exists(invalidDst))throw new AssertionError("Truncated archive wrote destination files");
   try {SaveArchive.backup(src.toString(),zip.toString());throw new AssertionError("Overwrote backup");}catch(FileAlreadyExistsException expected){}
   if(!Arrays.equals(archive,Files.readAllBytes(zip)))throw new AssertionError("Backup changed on conflict");
   Files.createDirectories(dst.resolve("profile"));Files.writeString(dst.resolve("profile/settings.txt"),"existing");
   String result=SaveArchive.restore(dst.toString(),zip.toString());
   if(!result.equals("Восстановлено: 1; пропущено существующих: 1") || !Arrays.equals(payload,Files.readAllBytes(dst.resolve("saves/world.save"))) || !Files.readString(dst.resolve("profile/settings.txt")).equals("existing"))throw new AssertionError("Import mismatch: "+result);
   Path malicious=test.resolve("bad.zip");try(var z=new ZipOutputStream(Files.newOutputStream(malicious))){z.putNextEntry(new ZipEntry("saves/staged.save"));z.write(1);z.closeEntry();z.putNextEntry(new ZipEntry("../escape"));z.write(1);z.closeEntry();}
   try {SaveArchive.restore(dst.toString(),malicious.toString());throw new AssertionError("Traversal accepted");}catch(java.io.IOException expected){}
   if(Files.exists(test.resolve("escape")) || Files.exists(dst.resolve("saves/staged.save")))throw new AssertionError("Invalid archive wrote file");
   Path nativeSave=test.resolve("native.save");Files.write(nativeSave,payload);
   if(!SaveArchive.importSave(dst.toString(),nativeSave.toString(),"native.save").equals("Восстановлено: 1; пропущено существующих: 0") || !Arrays.equals(payload,Files.readAllBytes(dst.resolve("saves/native.save"))))throw new AssertionError("Native import mismatch");
   Files.writeString(nativeSave,"replacement");
   if(!SaveArchive.importSave(dst.toString(),nativeSave.toString(),"native.save").equals("Восстановлено: 0; пропущено существующих: 1") || !Arrays.equals(payload,Files.readAllBytes(dst.resolve("saves/native.save"))))throw new AssertionError("Native import overwrote a save");
   try{SaveArchive.importSave(dst.toString(),nativeSave.toString(),"../escape.save");throw new AssertionError("Invalid save name accepted");}catch(java.io.IOException expected){}
   System.out.println("Save archive probe: PASS");
  } finally { try(var paths=Files.walk(test)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);} }
 }
}
