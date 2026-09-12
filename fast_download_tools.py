import os
import sys
import urllib.request
import zipfile
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

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

class HeadRequest(urllib.request.Request):
    def get_method(self):
        return "HEAD"

def get_file_info(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    # Open and immediately read headers without reading body
    with urllib.request.urlopen(req, timeout=30) as resp:
        final_url = resp.geturl()
        total_size = int(resp.getheader('content-length', 0))
    return final_url, total_size

def download_chunk(url, start_byte, end_byte, part_file):
    headers = {'User-Agent': 'Mozilla/5.0', 'Range': f'bytes={start_byte}-{end_byte}'}
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = resp.read()
                with open(part_file, 'wb') as f:
                    f.write(data)
                return True
        except Exception as e:
            time.sleep(1)
    return False

def fast_download(url, target_path, num_workers=10):
    if is_valid_zip(target_path):
        print(f"Valid zip exists: {target_path}", flush=True)
        return True

    print(f"Resolving URL info for: {url}", flush=True)
    final_url, total_size = get_file_info(url)
    print(f"Final URL: {final_url}")
    print(f"Total size: {total_size / (1024*1024):.2f} MB. Splitting across {num_workers} threads...", flush=True)

    if total_size == 0:
        print("Falling back to single-stream download...", flush=True)
        req = urllib.request.Request(final_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp, open(target_path, 'wb') as f:
            shutil.copyfileobj(resp, f)
        return True

    chunk_size = 4 * 1024 * 1024 # 4MB per chunk
    chunks = []
    start = 0
    while start < total_size:
        end = min(start + chunk_size - 1, total_size - 1)
        chunks.append((start, end))
        start = end + 1

    temp_dir = target_path + "_parts"
    os.makedirs(temp_dir, exist_ok=True)

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {}
        for i, (s, e) in enumerate(chunks):
            part_path = os.path.join(temp_dir, f"part_{i:04d}.dat")
            if os.path.exists(part_path) and os.path.getsize(part_path) == (e - s + 1):
                continue
            futures[executor.submit(download_chunk, final_url, s, e, part_path)] = i

        done_count = len(chunks) - len(futures)
        for fut in as_completed(futures):
            i = futures[fut]
            if fut.result():
                done_count += 1
                pct = (done_count / len(chunks)) * 100
                print(f"Downloaded {done_count}/{len(chunks)} chunks ({pct:.1f}%)", flush=True)
            else:
                print(f"Error downloading chunk {i}", flush=True)
                return False

    print("Assembling chunks...", flush=True)
    temp_target = target_path + ".assembling"
    with open(temp_target, 'wb') as outfile:
        for i in range(len(chunks)):
            part_path = os.path.join(temp_dir, f"part_{i:04d}.dat")
            with open(part_path, 'rb') as pf:
                outfile.write(pf.read())

    shutil.rmtree(temp_dir, ignore_errors=True)
    if os.path.exists(target_path):
        os.remove(target_path)
    os.rename(temp_target, target_path)
    print(f"Successfully downloaded: {target_path}", flush=True)
    return True

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
        jdk_url = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.12_7.zip"
        if fast_download(jdk_url, jdk_zip, num_workers=10):
            extract_zip(jdk_zip, TOOLS_DIR)
            for item in os.listdir(TOOLS_DIR):
                if item.startswith("jdk-17") and os.path.isdir(os.path.join(TOOLS_DIR, item)):
                    if os.path.exists(jdk_dir):
                        shutil.rmtree(jdk_dir)
                    os.rename(os.path.join(TOOLS_DIR, item), jdk_dir)
                    break
            print("JDK 17 ready at:", jdk_dir, flush=True)

    # 2. Download Android Command Line Tools
    sdk_dir = os.path.join(TOOLS_DIR, "android_sdk")
    cmdline_zip = os.path.join(TOOLS_DIR, "cmdline-tools.zip")
    cmdline_extract = os.path.join(sdk_dir, "cmdline-tools")
    latest_dir = os.path.join(cmdline_extract, "latest")
    
    if not os.path.exists(latest_dir) or not os.path.exists(os.path.join(latest_dir, "bin", "sdkmanager.bat")):
        cmdline_url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
        if fast_download(cmdline_url, cmdline_zip, num_workers=10):
            temp_extract = os.path.join(TOOLS_DIR, "temp_cmdline")
            os.makedirs(temp_extract, exist_ok=True)
            extract_zip(cmdline_zip, temp_extract)
            os.makedirs(cmdline_extract, exist_ok=True)
            src = os.path.join(temp_extract, "cmdline-tools")
            if os.path.exists(latest_dir):
                shutil.rmtree(latest_dir)
            shutil.move(src, latest_dir)
            shutil.rmtree(temp_extract, ignore_errors=True)
            print("Android cmdline-tools ready at:", latest_dir, flush=True)

    print("ALL TOOLS READY!", flush=True)

if __name__ == "__main__":
    main()
