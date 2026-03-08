import subprocess
import json

def check_metadata():
    try:
        result = subprocess.run(
            ['cargo', 'metadata', '--format-version', '1', '--manifest-path', 'src-tauri/Cargo.toml'],
            capture_output=True, text=True, encoding='utf-8'
        )
        if result.returncode != 0:
            print(f"Cargo error: {result.stderr}")
            return

        data = json.loads(result.stdout)
        packages_2024 = []
        for pkg in data.get('packages', []):
            if pkg.get('edition') == '2024' or pkg.get('edition') == 2024:
                packages_2024.append(f"{pkg.get('name')} (version: {pkg.get('version')})")
        
        if packages_2024:
            print("Found 2024 edition packages:")
            for p in packages_2024:
                print(f"- {p}")
        else:
            print("No 2024 edition packages found.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_metadata()
