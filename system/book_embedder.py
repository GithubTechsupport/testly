from mistralai import Mistral
from PyPDF2 import PdfReader
from dotenv import load_dotenv
import requests
import numpy as np
import os
from getpass import getpass
import time
from pymongo import MongoClient

load_dotenv()

MONGO_client = MongoClient(os.getenv("MONGO_URI"))
db = MONGO_client["bookTestMaker"]
collection = db["chunkEmbeddings"]

client = Mistral(api_key=os.getenv("MISTRAL_KEY"))

chunk_size = 2048

def function_timer(func):
    def wrapper(*args, **kwargs):
      start_time = time.time()
      result = func(*args, **kwargs)
      end_time = time.time()
      print(f"Function {func.__name__} took {end_time - start_time} seconds")
      return result
    return wrapper

@function_timer
def delete_all_chunks():
  print("Deleting entries...")
  collection.delete_many({})

@function_timer
def extract_chunks_from_pdf(pdf_path, chunk_size=chunk_size):
	reader = PdfReader(pdf_path)
	text = ""
	for page in reader.pages:
		text += page.extract_text() + "\n"
	chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
	return chunks

def get_text_embedding(input):
	embeddings_batch_response = client.embeddings.create(
		model="mistral-embed",
		inputs=input
	)
	time.sleep(0.17)
	return embeddings_batch_response.data[0].embedding

@function_timer
def all_text_embeddings(chunks):
	return np.array([get_text_embedding(chunk) for chunk in chunks])

@function_timer
def insert_into_mongo(chunks, embeddings, book):
	docs_to_insert = [{
    "book": book,
		"text": chunk,
		"embedding": embedding.tolist()  # Convert numpy array to list
	} for (chunk, embedding) in zip(chunks, embeddings)]
	result = collection.insert_many(docs_to_insert)
	return result

if __name__ == "__main__":
	delete_all_chunks()
	chunks = extract_chunks_from_pdf("Jakki.pdf")
	print(len(chunks))

	embeddings = all_text_embeddings(chunks)
	insert_into_mongo(chunks, embeddings, "Marketing of High-technology Products and Innovations")