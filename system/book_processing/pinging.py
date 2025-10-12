import os
import sys
import requests
from dotenv import load_dotenv

# filepath: c:/Users/aryan/OneDrive/Skrivebord/testly/system/book_processing/pinging.py

def main():
  # Load environment variables from .env
  load_dotenv()
  api_key = os.getenv("MISTRAL_KEY")

  if not api_key:
    print("Error: MISTRAL_KEY not found in environment.")
    sys.exit(1)

  # endpoint to list models (basic auth check)
  url = "https://api.mistral.ai/v1/models"
  headers = {
    "Authorization": f"Bearer {api_key}"
  }

  try:
    resp = requests.get(url, headers=headers, timeout=10)
  except requests.RequestException as e:
    print(f"Network error: {e}")
    sys.exit(1)

  if resp.status_code == 200:
    data = resp.json()
    models = data.get("data", [])
    print(f"✅ Valid API key. Found {len(models)} models.")
  elif resp.status_code == 401:
    print("❌ Unauthorized: Invalid or expired API key.")
    sys.exit(1)
  else:
    print(f"❌ Unexpected status ({resp.status_code}): {resp.text}")
    sys.exit(1)

if __name__ == "__main__":
  main()