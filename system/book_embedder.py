from PyPDF2 import PdfReader
from dotenv import load_dotenv
import requests
import numpy as np
import os
from pymongo import MongoClient
from models import MistralEmbed, MistralOCR
from function_timer import function_timer
from io import BytesIO
from mistral_tokenizer import MistralTokenizer
from mongo_commands import delete_collection, get_entry_single

load_dotenv()

MONGO_client = MongoClient(os.getenv("MONGO_URI"))
db = MONGO_client["bookTestMaker"]
embedding_collection = db["chunkEmbeddings"]
subchapter_collection = db["subchapters"]
mistral_tokenizer = MistralTokenizer()

OCR_model = MistralOCR()

max_chunk_size = 3064

def chunk_text(text, overlap = 50, max_chunk_size = max_chunk_size):
	#tokens = mistral_tokenizer.encode(text)  # Convert text to tokens
	chunks = []
	
	for i in range(0, len(text), max_chunk_size - overlap):
		chunk = text[i : i + max_chunk_size]
		chunks.append(chunk)
		
		if i + max_chunk_size >= len(text):
				break
	
	return chunks

@function_timer
def test_ocr():
	entry = get_entry_single(subchapter_collection, "subchapter_title", "1.4 Measures of Variability")
	url = entry.get("s3_link")
	response = OCR_model.generate_response(url)
	print(response)

@function_timer
def get_chunks(book_name, ocr = False):
	print("Getting subchapters...")
	chunks = []
	subchapters = []
	collection = subchapter_collection.find({"book_name": book_name})
	total = subchapter_collection.count_documents({"book_name": book_name})
	print("Subchapters retrieved")
	print("Creating chunks...")
	for i, subchapter in enumerate(collection, start=0):
		subchapter_title = subchapter.get("subchapter_title")
		pdf_url = subchapter.get("s3_link")
		text = ""
		if ocr:
			response = OCR_model.generate_response(pdf_url)
			text = response
		else:
			response = requests.get(pdf_url)
			pdf_file = BytesIO(response.content)
			reader = PdfReader(pdf_file)
			for j in range(len(reader.pages)):
				text += reader.pages[j].extract_text()
		current_chunks = chunk_text(text)
		chunks.extend(current_chunks)
		subchapters.extend([subchapter_title]*len(current_chunks))
		print(f"{i} / {total}", end="\r")
	print("Chunks created")
	return chunks, subchapters

@function_timer
def all_text_embeddings(chunks):
	print("Embedding chunks...")
	total = len(chunks)
	model = MistralEmbed()
	embeddings_list = []
	for i, chunk in enumerate(chunks, start=0):
		try:
			embeddings_list.append(model.generate_response(chunk))
		except Exception as e:
			print(f"Error embedding chunk: {e}\nChunk: {chunk}")
			continue
		print(f"{i} / {total}", end="\r")
	print("Chunks embedded")
	return embeddings_list

@function_timer
def insert_into_mongo(chunks, embeddings, subchapters, book_name):
	print("Inserting into MongoDB...")
	docs_to_insert = [{
    "book_name": book_name,
		"subchapter_title": subchapter,
		"text": chunk,
		"embedding": embedding  
	} for (chunk, embedding, subchapter) in zip(chunks, embeddings, subchapters)]
	result = embedding_collection.insert_many(docs_to_insert)
	print("Inserted into MongoDB")
	return result

if __name__ == "__main__":
	delete_collection(embedding_collection)
	book_name = "Modern Mathematical Statistics with Applications Third Edition"
	chunks, subchapters = get_chunks(book_name)
	embeddings = all_text_embeddings(chunks)
	insert_into_mongo(chunks, embeddings, subchapters, book_name)