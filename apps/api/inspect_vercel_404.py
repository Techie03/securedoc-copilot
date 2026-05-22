import urllib.request
import urllib.error

url = "https://securedoc-copilot.vercel.app/api/health"
print(f"Requesting Vercel API: {url}")
try:
    with urllib.request.urlopen(url) as response:
        html = response.read().decode('utf-8')
        print(f"Success! Response: {html}")
except urllib.error.HTTPError as e:
    print(f"HTTPError Status Code: {e.code}")
    print(f"HTTPError Reason: {e.reason}")
    try:
        body = e.read().decode('utf-8')
        print(f"HTTPError Body: {body}")
    except Exception as read_err:
        print(f"Could not read error body: {read_err}")
except Exception as e:
    print(f"Generic error: {e}")
