import urllib.request
import os
import zipfile
import shutil

JDK21_URL = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_windows_hotspot_21.0.5_11.zip"
DEST_DIR = r"C:\Users\LENOVO\Desktop\gptt\.tools"
ZIP_PATH = os.path.join(DEST_DIR, "jdk21.zip")
JDK21_DIR = os.path.join(DEST_DIR, "jdk21")

def download_with_progress(url, dest):
    print(f"Downloading JDK 21 from: {url}")
    def reporthook(count, block_size, total_size):
        if total_size > 0:
            pct = int(count * block_size * 100 / total_size)
            print(f"\r  Progress: {pct}%", end="", flush=True)
    urllib.request.urlretrieve(url, dest, reporthook)
    print("\nDownload complete.")

if not os.path.exists(ZIP_PATH):
    download_with_progress(JDK21_URL, ZIP_PATH)
else:
    print("JDK21 zip already exists, skipping download.")

if os.path.exists(JDK21_DIR):
    print("JDK21 dir already exists, skipping extraction.")
else:
    print("Extracting JDK21...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as z:
        z.extractall(DEST_DIR)
    # Rename extracted folder (e.g. jdk-21.0.5+11) to jdk21
    extracted = [d for d in os.listdir(DEST_DIR) if d.startswith("jdk-21") and os.path.isdir(os.path.join(DEST_DIR, d))]
    if extracted:
        src = os.path.join(DEST_DIR, extracted[0])
        print(f"Renaming {src} -> {JDK21_DIR}")
        os.rename(src, JDK21_DIR)
    print("JDK21 extracted.")

java_exe = os.path.join(JDK21_DIR, "bin", "java.exe")
if os.path.exists(java_exe):
    print(f"SUCCESS: JDK21 ready at {JDK21_DIR}")
else:
    print(f"ERROR: java.exe not found at {java_exe}")
