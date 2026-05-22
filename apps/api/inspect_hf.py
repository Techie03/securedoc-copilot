import urllib.request
import urllib.error
import json

endpoints = [
    "https://nishith374-securedoc-api.hf.space/health",
    "https://nishith374-securedoc-api.hf.space/api/diagnostics"
]

for url in endpoints:
    print(f"Requesting HF Space API: {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"[{status}] Success! Response: {body}\n")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] HTTPError: {e.reason}")
        try:
            body = e.read().decode('utf-8')
            print(f"Error Body: {body}\n")
        except Exception:
            print("Could not read body.\n")
    except Exception as e:
        print(f"Generic error: {e}\n")
