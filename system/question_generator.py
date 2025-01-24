from pymongo import MongoClient
import os
import requests

client = MongoClient(os.getenv("MONGO_URI"))
db = client["bookTestMaker"]
collection = db["subchapters"]

for doc in collection.find():
  pdf_url = doc.get("s3_link")
  if pdf_url:
    response = requests.get(pdf_url)
    print(response.content)