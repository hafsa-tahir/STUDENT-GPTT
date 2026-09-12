import os
import sys
import urllib.request
import zipfile
import shutil

WORKSPACE = r"c:\Users\LENOVO\Desktop\gptt"
TOOLS_DIR = os.path.join(WORKSPACE, ".tools")
os.makedirs(TOOLS_DIR, exist_ok=True)

def download_file(url, target_path):
    if os.path.exists(target_path):
        print(f"Already exists: {target_path}")
        return
    print(f"Downloading {url} to {target_path}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(target_path, 'wb') as out_file:
        length = response.getheader('content-length')
        if length:
            total_size = int(length)
            downloaded = 0
            block_size = 1024 * 1024 # 1MB
            while True:
                chunk = response.read(block_size)
                if not chunk:
                    break
                downloaded += len(chunk)
                out_file.write(chunk)
                percent = (downloaded / total_size) * 100
                print(f"Progress: {downloaded / (1024*1024):.1f}MB / {total_size / (1024*1024):.1f}MB ({percent:.1f}%)", end='\r')
            print()
        else:
            shutil.copyfileobj(response, out_file)
    print("Download complete.")

def extract_zip(zip_path, extract_to):
    print(f"Extracting {zip_path} to {extract_to}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    print("Extraction complete.")

def main():
    # 1. Download & extract Node.js
    node_zip = os.path.join(TOOLS_DIR, "node.zip")
    node_dir = os.path.join(TOOLS_DIR, "node")
    if not os.path.exists(node_dir):
        download_file("https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip", node_zip)
        extract_zip(node_zip, TOOLS_DIR)
        for item in os.listdir(TOOLS_DIR):
            if item.startswith("node-v20") and os.path.isdir(os.path.join(TOOLS_DIR, item)):
                os.rename(os.path.join(TOOLS_DIR, item), node_dir)
                break

    # 2. Download & extract MinGit
    git_zip = os.path.join(TOOLS_DIR, "git.zip")
    git_dir = os.path.join(TOOLS_DIR, "git")
    if not os.path.exists(git_dir):
        os.makedirs(git_dir, exist_ok=True)
        download_file("https://github.com/git-for-windows/git/releases/download/v2.46.0.windows.1/MinGit-2.46.0-64-bit.zip", git_zip)
        extract_zip(git_zip, git_dir)

    # 3. Download & extract JDK 17
    jdk_zip = os.path.join(TOOLS_DIR, "jdk17.zip")
    jdk_dir = os.path.join(TOOLS_DIR, "jdk17")
    if not os.path.exists(jdk_dir):
        download_file("https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip", jdk_zip)
        extract_zip(jdk_zip, TOOLS_DIR)
        for item in os.listdir(TOOLS_DIR):
            if item.startswith("jdk-17") and os.path.isdir(os.path.join(TOOLS_DIR, item)):
                os.rename(os.path.join(TOOLS_DIR, item), jdk_dir)
                break

    # 4. Download & extract Android cmdline-tools
    sdk_dir = os.path.join(TOOLS_DIR, "android_sdk")
    os.makedirs(sdk_dir, exist_ok=True)
    cmdline_zip = os.path.join(TOOLS_DIR, "cmdline-tools.zip")
    cmdline_extract = os.path.join(sdk_dir, "cmdline-tools")
    latest_target = os.path.join(cmdline_extract, "latest")
    
    if not os.path.exists(latest_target):
        download_file("https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip", cmdline_zip)
        temp_extract = os.path.join(TOOLS_DIR, "temp_cmdline")
        os.makedirs(temp_extract, exist_ok=True)
        extract_zip(cmdline_zip, temp_extract)
        os.makedirs(cmdline_extract, exist_ok=True)
        source_dir = os.path.join(temp_extract, "cmdline-tools")
        if os.path.exists(latest_target):
            shutil.rmtree(latest_target)
        shutil.move(source_dir, latest_target)
        shutil.rmtree(temp_extract, ignore_errors=True)

    print("All toolchains downloaded and extracted successfully!")

if __name__ == "__main__":
    main()
