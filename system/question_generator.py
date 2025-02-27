from pymongo import MongoClient
from openai import OpenAI
from PyPDF2 import PdfReader
import os
import requests
from dotenv import load_dotenv
from io import BytesIO
load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["bookTestMaker"]
collection = db["subchapters"]

subchapters = []

for subchapter in collection.find():
  pdf_url = subchapter.get("s3_link")
  response = requests.get(pdf_url)
  pdf_file = BytesIO(response.content)
  reader = PdfReader(pdf_file)
  text = ""
  for i in range(len(reader.pages)):
      text += reader.pages[i].extract_text()
  subchapters.append(text)

print(subchapters[5])

client = OpenAI(api_key=os.getenv("MODEL_API_KEY"), base_url="https://api.deepseek.com")

system_prompt = 

# response = client.chat.completions.create(
#     model="deepseek-chat",
#     messages=[
#         {"role": "system", "content": "You are a helpful assistant"},
#         {"role": "user", "content": "Hello"},
#     ],
#     stream=False
# )