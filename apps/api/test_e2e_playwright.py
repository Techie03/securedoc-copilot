import sys
import time
import uuid
from playwright.sync_api import sync_playwright

def run_test():
    email = f"playwright_tester_{uuid.uuid4().hex[:6]}@securedoc.com"
    password = "password123!"
    full_name = "Playwright Tester"
    new_ws_name = "Playwright NIM Lab"
    
    print(f"Starting E2E Playwright test with email: {email}")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser Page Error] {err.message}"))

        # 1. Navigate to home
        print("Navigating to home page http://127.0.0.1:3000/ ...")
        page.goto("http://127.0.0.1:3000/")
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        page.screenshot(path="screenshot_1_home.png")
        print("Screenshot 1: Home page saved.")

        # 2. Click Sign Up
        print("Clicking Sign Up link/button...")
        signup_btn = page.locator("a[href='/signup']")
        signup_btn.click()
        page.wait_for_url("**/signup")
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        page.screenshot(path="screenshot_2_signup.png")
        print("Screenshot 2: Signup page saved.")

        # 3. Fill Signup Form
        print("Filling in the signup form...")
        page.fill("#name", full_name)
        page.fill("#email", email)
        page.fill("#password", password)
        page.screenshot(path="screenshot_2b_signup_filled.png")
        
        print("Submitting signup form...")
        page.click("button[type='submit']")
        
        # Wait for redirection to dashboard
        print("Waiting for dashboard redirect...")
        page.wait_for_url("**/dashboard", timeout=15000)
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path="screenshot_3_dashboard.png")
        print("Screenshot 3: Dashboard saved.")

        # Verify default workspace name "Playwright Tester's Workspace" is visible
        ws_element = page.locator(f"text={full_name}'s Workspace")
        if ws_element.count() > 0:
            print(f"[VERIFIED] Default '{full_name}'s Workspace' is visible.")
        else:
            print(f"[WARNING] '{full_name}'s Workspace' text not found, page content is:")
            print(page.content()[:1000])

        # 4. Open workspace creation modal via 'New Workspace' button
        print("Clicking 'New Workspace' button...")
        new_ws_btn = page.locator("button:has-text('New Workspace')")
        new_ws_btn.click()
        time.sleep(1)
        page.screenshot(path="screenshot_4_ws_modal.png")
        print("Screenshot 4: Workspace creation modal saved.")

        # 5. Fill Workspace Form
        print("Filling Workspace name...")
        page.fill("#dashboard-ws-name", new_ws_name)
        page.screenshot(path="screenshot_4b_ws_modal_filled.png")
        
        print("Submitting workspace creation...")
        page.click("button[type='submit']:has-text('Initialize Workspace')")
        time.sleep(2)
        page.screenshot(path="screenshot_5_ws_created.png")
        print("Screenshot 5: Workspace created.")

        # Verify new workspace name is visible on the page
        new_ws_element = page.locator(f"text={new_ws_name}")
        if new_ws_element.count() > 0:
            print(f"[VERIFIED] New workspace '{new_ws_name}' is visible.")
        else:
            print(f"[WARNING] New workspace '{new_ws_name}' text not found.")

        # 6. Click User Dropdown
        print("Clicking User Menu Dropdown...")
        user_menu_btn = page.locator(f"button:has-text('{full_name}')")
        if user_menu_btn.count() == 0:
            user_menu_btn = page.locator(f"button:has-text('{full_name.split()[0]}')")
        if user_menu_btn.count() == 0:
            user_menu_btn = page.locator("button:has(div.bg-gradient-to-tr)")
            
        user_menu_btn.first.click()
        time.sleep(1)
        page.screenshot(path="screenshot_6_user_menu.png")
        print("Screenshot 6: User menu saved.")

        # 7. Click Sign Out
        print("Clicking Sign Out...")
        signout_btn = page.locator("button:has-text('Sign Out')")
        signout_btn.click()
        
        # Wait for redirect to login
        page.wait_for_url("**/login", timeout=10000)
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        page.screenshot(path="screenshot_7_login.png")
        print("Screenshot 7: Redirected to Login page.")

        # 8. Log in again
        print("Logging in with newly created credentials...")
        page.fill("#email", email)
        page.fill("#password", password)
        page.screenshot(path="screenshot_7b_login_filled.png")
        page.click("button[type='submit']")
        
        page.wait_for_url("**/dashboard", timeout=15000)
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path="screenshot_8_final.png")
        print("Screenshot 8: Back to dashboard.")
        
        # Verify workspaces are present
        ws_elements = page.locator("text=Playwright Tester")
        if ws_elements.count() > 0:
            print("[SUCCESS] Found user profile name after logging in again.")
        else:
            print("[WARNING] Profile name not found after login.")
            
        browser.close()
        print("E2E test run finished successfully!")

if __name__ == "__main__":
    run_test()

