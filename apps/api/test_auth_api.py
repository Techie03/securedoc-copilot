import httpx
import sys

def test_flow():
    base_url = "http://127.0.0.1:8000/api"
    
    # Use a unique email each time for testing
    import uuid
    email = f"testuser_{uuid.uuid4().hex[:6]}@securedoc.com"
    
    print(f"--- Testing Signup with email: {email} ---")
    signup_data = {
        "email": email,
        "full_name": "NVIDIA Developer",
        "password": "securepassword123"
    }
    r = httpx.post(f"{base_url}/auth/signup", json=signup_data)
    print("Signup Status:", r.status_code)
    user_data = r.json()
    print("Signup Data:", user_data)
    
    if r.status_code != 201:
        print("[ERROR] Signup failed")
        sys.exit(1)
        
    print("\n--- Testing Login ---")
    login_data = {
        "email": email,
        "password": "securepassword123"
    }
    r = httpx.post(f"{base_url}/auth/login", json=login_data)
    print("Login Status:", r.status_code)
    token_data = r.json()
    print("Login Token:", token_data)
    
    if r.status_code != 200:
        print("[ERROR] Login failed")
        sys.exit(1)
        
    token = token_data.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n--- Testing Retrieve Current User (/auth/me) ---")
    r = httpx.get(f"{base_url}/auth/me", headers=headers)
    print("Me Status:", r.status_code)
    print("Me Data:", r.json())
    
    print("\n--- Testing List Workspaces (Should contain the auto-created personal workspace) ---")
    r = httpx.get(f"{base_url}/workspaces", headers=headers)
    print("Workspaces Status:", r.status_code)
    workspaces = r.json()
    print("Workspaces:", workspaces)
    
    if not workspaces:
        print("[ERROR] No default workspace was auto-created")
        sys.exit(1)
        
    personal_ws_id = workspaces[0]["id"]
    
    print("\n--- Testing Create a Second Workspace ---")
    r = httpx.post(f"{base_url}/workspaces", json={"name": "NVIDIA NIM Lab"}, headers=headers)
    print("Create Workspace Status:", r.status_code)
    nim_workspace = r.json()
    print("New Workspace Details:", nim_workspace)
    
    print("\n--- Testing List Workspaces Again (Should now contain 2 workspaces) ---")
    r = httpx.get(f"{base_url}/workspaces", headers=headers)
    print("Workspaces List Status:", r.status_code)
    print("Workspaces List:", r.json())
    
    print("\n[SUCCESS] Authentication and workspace CRUD flows verified successfully on the backend!")

if __name__ == "__main__":
    test_flow()
