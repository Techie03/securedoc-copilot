import os
from PIL import Image

src_path = r"C:\Users\nishi\.gemini\antigravity-ide\brain\733fb503-8424-4572-a540-8b0c4df03df1\media__1779468813277.png"
public_dir = r"c:\Users\nishi\Desktop\secure-doc Copilot\apps\web\public"
app_dir = r"c:\Users\nishi\Desktop\secure-doc Copilot\apps\web\src\app"

print(f"Loading source image from: {src_path}")
img = Image.open(src_path)

# Ensure folders exist
os.makedirs(public_dir, exist_ok=True)
os.makedirs(app_dir, exist_ok=True)

# Generate favicon.ico (multi-size)
sizes = [(16, 16), (32, 32), (48, 48)]
img.save(os.path.join(app_dir, "favicon.ico"), format="ICO", sizes=sizes)
img.save(os.path.join(public_dir, "favicon.ico"), format="ICO", sizes=sizes)
print("Saved favicon.ico to app and public folders")

# Generate apple-touch-icon.png (180x180)
img.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
print("Saved apple-touch-icon.png")

# Generate favicon-96x96.png
img.resize((96, 96), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon-96x96.png"), "PNG")
print("Saved favicon-96x96.png")

# Generate manifest PNGs
img.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "web-app-manifest-192x192.png"), "PNG")
img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "web-app-manifest-512x512.png"), "PNG")
print("Saved web-app-manifest PNG files")

print("All favicon assets generated successfully!")
