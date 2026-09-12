import os
import sys
import subprocess

WORKSPACE = r"c:\Users\LENOVO\Desktop\gptt"
TOOLS_DIR = os.path.join(WORKSPACE, ".tools")
JDK_DIR = os.path.join(TOOLS_DIR, "jdk17")
SDK_DIR = os.path.join(TOOLS_DIR, "android_sdk")
CMDLINE_BIN = os.path.join(SDK_DIR, "cmdline-tools", "latest", "bin")

def setup_licenses():
    licenses_dir = os.path.join(SDK_DIR, "licenses")
    os.makedirs(licenses_dir, exist_ok=True)
    
    sdk_licenses = [
        "24333f8a6366825e34773a4e12e7784f188339c0",
        "89338d0d107297f46501777998fde7001409e0e8",
        "d56f5187479451eabf01fb78af6dfcb131a6481e",
        "84831b9409646a532e303d79b65c66fba4b5acd7",
        "601085b94cd77f0b54ff864069570991500085d7",
        "33b6a2b64607f11b759f320ef9dff4ae5c47d97a"
    ]
    with open(os.path.join(licenses_dir, "android-sdk-license"), "w") as f:
        f.write("\n".join(sdk_licenses) + "\n")
        
    preview_licenses = [
        "84831b9409646a532e303d79b65c66fba4b5acd7",
        "504667f4c0de7e4f5147e3044929dcbe93b9e984"
    ]
    with open(os.path.join(licenses_dir, "android-sdk-preview-license"), "w") as f:
        f.write("\n".join(preview_licenses) + "\n")

    print("Licenses written successfully.", flush=True)

def install_packages():
    env = os.environ.copy()
    env["JAVA_HOME"] = JDK_DIR
    env["ANDROID_HOME"] = SDK_DIR
    env["ANDROID_SDK_ROOT"] = SDK_DIR
    env["PATH"] = f"{os.path.join(JDK_DIR, 'bin')};{CMDLINE_BIN};{os.path.join(TOOLS_DIR, 'node')};{env.get('PATH', '')}"

    sdkmanager = os.path.join(CMDLINE_BIN, "sdkmanager.bat")
    if not os.path.exists(sdkmanager):
        print("sdkmanager not found at:", sdkmanager, flush=True)
        return False
        
    print("Accepting any remaining licenses with sdkmanager...", flush=True)
    p = subprocess.Popen([sdkmanager, "--licenses", f"--sdk_root={SDK_DIR}"], 
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
                         env=env, text=True)
    out, _ = p.communicate(input="y\ny\ny\ny\ny\ny\ny\ny\ny\ny\ny\n")
    print(out[-500:] if len(out) > 500 else out, flush=True)

    packages = ["platforms;android-34", "build-tools;34.0.0", "platform-tools"]
    print(f"Installing SDK packages: {packages}...", flush=True)
    cmd = [sdkmanager, f"--sdk_root={SDK_DIR}"] + packages
    p2 = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          env=env, text=True)
    out2, _ = p2.communicate(input="y\ny\ny\ny\n")
    print(out2, flush=True)
    return p2.returncode == 0

def main():
    setup_licenses()
    if install_packages():
        print("Android SDK packages installed successfully!", flush=True)
    else:
        print("SDK package install encountered an issue", flush=True)

if __name__ == "__main__":
    main()
