import os
import sys
import urllib.request
import zipfile
import shutil
import time

WORKSPACE = r"c:\Users\LENOVO\Desktop\gptt"
TOOLS_DIR = os.path.join(WORKSPACE, ".tools")
os.makedirs(TOOLS_DIR, exist_ok=True)

def is_valid_zip(file_path):
    if not os.path.exists(file_path):
        return False
    try:
        with zipfile.ZipFile(file_path, 'r') as zf:
            return zf.testzip() is None
    except Exception:
        return False

def download_file_robust(url, target_path):
    if is_valid_zip(target_path):
        print(f"Valid zip already exists: {target_path} ({os.path.getsize(target_path)} bytes)")
        return
    if os.path.exists(target_path):
        os.remove(target_path)
        
    print(f"Downloading {url} to {target_path}...", flush=True)
    headers = {'User-Agent': 'Mozilla/5.0'}
    req = urllib.request.Request(url, headers=headers)
    
    temp_path = target_path + ".tmp"
    if os.path.exists(temp_path):
        os.remove(temp_path)

    with urllib.request.urlopen(req, timeout=60) as response, open(temp_path, 'wb') as out_file:
        total_size = int(response.getheader('content-length', 0))
        downloaded = 0
        block_size = 2 * 1024 * 1024 # 2MB
        start_time = time.time()
        while True:
            chunk = response.read(block_size)
            if not chunk:
                break
            downloaded += len(chunk)
            out_file.write(chunk)
            elapsed = time.time() - start_time
            speed = (downloaded / (1024 * 1024)) / max(elapsed, 0.001)
            pct = (downloaded / total_size * 100) if total_size > 0 else 0
            print(f"[{pct:5.1f}%] {downloaded/(1024*1024):.1f}MB / {total_size/(1024*1024):.1f}MB ({speed:.2f} MB/s)", flush=True)
    if os.path.exists(target_path):
        os.remove(target_path)
    os.rename(temp_path, target_path)
    print(f"Download complete: {target_path}", flush=True)

def extract_zip(zip_path, extract_to):
    print(f"Extracting {zip_path} to {extract_to}...", flush=True)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    print(f"Extraction complete for {zip_path}", flush=True)

def main():
    # 1. Download JDK 17
    jdk_dir = os.path.join(TOOLS_DIR, "jdk17")
    jdk_zip = os.path.join(TOOLS_DIR, "jdk17.zip")
    if not os.path.exists(jdk_dir) or not os.path.exists(os.path.join(jdk_dir, "bin", "javac.exe")):
        # OpenJDK 17 Temurin direct release
        jdk_url = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.12_7.zip"
        download_file_robust(jdk_url, jdk_zip)
        extract_zip(jdk_zip, TOOLS_DIR)
        for item in os.listdir(TOOLS_DIR):
            if item.startswith("jdk-17") and os.path.isdir(os.path.join(TOOLS_DIR, item)):
                if os.path.exists(jdk_dir):
                    shutil.rmtree(jdk_dir)
                os.rename(os.path.join(TOOLS_DIR, item), jdk_dir)
                break
        print("JDK 17 installed to:", jdk_dir, flush=True)

    # 2. Download Android Command Line Tools
    sdk_dir = os.path.join(TOOLS_DIR, "android_sdk")
    cmdline_zip = os.path.join(TOOLS_DIR, "cmdline-tools.zip")
    cmdline_extract = os.path.join(sdk_dir, "cmdline-tools")
    latest_dir = os.path.join(cmdline_extract, "latest")
    
    if not os.path.exists(latest_dir) or not os.path.exists(os.path.join(latest_dir, "bin", "sdkmanager.bat")):
        cmdline_url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
        download_file_robust(cmdline_url, cmdline_zip)
        temp_extract = os.path.join(TOOLS_DIR, "temp_cmdline")
        os.makedirs(temp_extract, exist_ok=True)
        extract_zip(cmdline_zip, temp_extract)
        os.makedirs(cmdline_extract, exist_ok=True)
        src = os.path.join(temp_extract, "cmdline-tools")
        if os.path.exists(latest_dir):
            shutil.rmtree(latest_dir)
        shutil.move(src, latest_dir)
        shutil.rmtree(temp_extract, ignore_errors=True)
        print("Android cmdline-tools installed to:", latest_dir, flush=True)

    print("ALL TOOLS READY!", flush=True)

if __name__ == "__main__":
    main()
