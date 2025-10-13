from pymongo import MongoClient
from PyPDF2 import PdfReader
import os
import requests
from dotenv import load_dotenv
from io import BytesIO
from function_timer import function_timer
from models import DeepseekModel, MistralModel, MistralEmbed, MistralSmall
from pymongo.operations import SearchIndexModel
from mistral_tokenizer import MistralTokenizer
from mongo_commands import delete_collection, get_entry_single, delete_entries
import numpy as np
import json
from operator import itemgetter
from bson import ObjectId
import book_titles

load_dotenv()

Mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = Mongo_client["bookTestMaker"]
subchapter_collection = db["subchapters"]
question_collection = db["questions"]
books_collection = db["books"]
chunkEmbedding_collection = db["chunkEmbeddings"]
mistral_tokenizer = MistralTokenizer()

embed_model = MistralEmbed()
mistral_small_model = MistralSmall()

RAG_depth = 5

questions_per_chapter = 8  # Change this value to adjust the number of questions per subchapter
difficulty_distribution = {"easy ": 33, "medium": 33, "hard": 33}  # Adjust the difficulty percentages as needed

@function_timer
def get_subchapters(name, id=None):
  print("Getting subchapters...")
  subchapters = []
  subchapter_ids = None
  if id:
    subchapter_ids = books_collection.find_one({ "_id": ObjectId(id) })["subchapter_ids"]
  else:
    subchapter_ids = books_collection.find_one({ "book_title": name })["subchapter_ids"]
  docs = list(subchapter_collection.find({"_id": {"$in": subchapter_ids}}))
  for subchapter in docs[9:10]:
    pdf_url = subchapter.get("s3_link")
    book_name = subchapter.get("book_name")
    chapter_title = subchapter.get("chapter_title")
    subchapter_title = subchapter.get("subchapter_title")
    print(subchapter_title)
    response = requests.get(pdf_url)
    pdf_file = BytesIO(response.content)
    reader = PdfReader(pdf_file)
    text = ""
    for i in range(len(reader.pages)):
        text += reader.pages[i].extract_text()
    subchapters.append(
      {
        "book_name": book_name,
        "chapter_title": chapter_title,
        "subchapter_title": subchapter_title,
        "text": text
      }
    )
  print("Subchapters retrieved")
  return subchapters

def embed_input(subchapter_text, overlap = 50, max_chunk_size = 3064):
  token_amount = len(mistral_tokenizer.encode(subchapter_text))
  print("Number of tokens:", token_amount)
  embeddings = []
  text = subchapter_text
  for i in range(0, len(text), max_chunk_size - overlap):
    chunk = text[i : i + max_chunk_size]
    embeddings.append(embed_model.generate_response(chunk))

    if i + max_chunk_size >= len(text):
        break
  return np.mean(np.array(embeddings), axis=0).tolist()

def retrieve_context(book_name, subchapter_title, subchapter_text):
  """Gets results from a vector search query."""
  try:
    query_embedding = embed_input(subchapter_text)
    pipeline = [
      {
        "$vectorSearch": {
          "index": "vector_index",
          "queryVector": query_embedding,
          "path": "embedding",
          "filter": { "book_name": book_name, "subchapter_title": { "$ne": subchapter_title } },
          "exact": True,
          "limit": RAG_depth
        }
      }, {
        "$project": {
          "_id": 0,
          "text": 1,
          "subchapter_title": 2
        }
      }
    ]
    results = chunkEmbedding_collection.aggregate(pipeline)
    array_of_results = []
    for doc in results:
      array_of_results.append(doc)
    return array_of_results
  except Exception as e:
    print(f"Error retrieving context: {e}")
    exit()
    return []

def build_prompt(subchapter, questions_per_chapter, difficulty_distribution):
  prompt = (
    "You are an exam maker responsible for creating exam questions for a chosen subchapter in a textbook for students to practice with.\n\n"
    f"Textbook: {subchapter.get('book_name')}\n"
    f"Chapter title: {subchapter.get('chapter_title')}\n"
    f"Subchapter title: {subchapter.get('subchapter_title')}\n"
    f"Generate {questions_per_chapter} questions.\n"
    "The output should be a json object with a key 'questions', containing a list of questions: [question1, question2, etc.]\n"
    "Each question in the list should be json objects with the following fields: text, alternatives, correct_alternative, difficulty\n"
    "IMPORTANT!!! You should add 2 new questions at the end that have completely wrong alternatives and are unrelated and dont make sense\n"
    "###\n"
    "Examples:\n\n"
    "Text: subchapter about pathfinding algorithms\n"
    "JSON:\n"
    "{\n"
    "  'questions': [\n"
    "    {\n"
    "      'text': 'What is the time complexity of Dijkstra\'s algorithm?',\n"
    "      'alternatives': ['O(n)', 'O(n^2)', 'O(n log n)', 'O(n^3)'],\n"
    "      'correct_alternative': 'C',\n"
    "      'difficulty': 'easy'\n"
    "    },\n"
    "    {\n"
    "      'text': 'What is the time complexity of A* algorithm?',\n"
    "      'alternatives': ['O(n)', 'O(n^2)', 'O(n log n)', 'O(n^3)'],\n"
    "      'correct_alternative': 'C',\n"
    "      'difficulty': 'easy'\n"
    "    }\n"
    "  ]\n"
    "}\n"
    "Text: subchapter about Plato's philosophy\n"
    "JSON:\n"
    "{\n"
    "  'questions': [\n"
    "    {\n"
    "      'text': 'What is the name of Plato's most famous work?',\n"
    "      'alternatives': ['The Republic', 'The Prince', 'The Odyssey', 'The Iliad'],\n"
    "      'correct_alternative': 'A',\n"
    "      'difficulty': 'easy'\n"
    "    },\n"
    "    {\n"
    "      'text': 'What is the name of Plato's teacher?',\n"
    "      'alternatives': ['Aristotle', 'Socrates', 'Pythagoras', 'Homer'],\n"
    "      'correct_alternative': 'B',\n"
    "      'difficulty': 'easy'\n"
    "    }\n"
    "  ]\n"
    "}\n"
    "\n###\n"

    "<<<\n"
    f"Text:{subchapter.get('text')}\n"
    ">>>"
  )
  for difficulty, percentage in difficulty_distribution.items():
    prompt += f"- {difficulty.capitalize()}: {percentage}% of the questions\n"
  prompt += "\nEnsure that the questions can be understood without needing to read the subchapter text by supplying the necessary context."

  context = retrieve_context(subchapter.get('book_name'), subchapter.get('subchapter_title'), prompt)
  most_relevant_text = ""
  if len(context) > 0:
    for entry in context:
      print(entry["subchapter_title"])
      most_relevant_text += entry["text"] + "\n\n"
  return prompt + "\n" + "Context that might be useful, but is not always necessary:\n" + most_relevant_text

def evaluate_response(response):
  prompt = (
    "Evaluate the question based on these criteria: \n\n The question and the answer should be correct\n"
    "There should not be any spelling mistakes or grammatical mistakes.\nThe question should not require immediate context from the book\n\n"
    "Return a JSON object with a key 'scores'; a list of numbers indicating the confidence score of the question at that index.\n"
    "The scores should be between 0 and 1, where 1 is the highest confidence and 0 is the lowest. Scores under 0.5 are generally of bad quality.\n"
    "###\n"
    "Examples:\n\n"
    "Questions object: An object with 7 questions\n"
    "JSON:\n"
    "{scores: [0.7, 0.9, 0.5, 0.45, 0.95, 0.11, 0.23]}\n"
    "###\n"
    "<<<\n"
    f"Questions object:{response}\n"
    ">>>"
  )
  questions = json.loads(response)["questions"]
  evaluated_response = mistral_small_model.generate_response(prompt)
  scores = json.loads(evaluated_response)["scores"]
  for i, score in enumerate(scores):
    questions[i]["confidence"] = score
  return questions

def insert_to_mongodb(questions, subchapter):
  for question in questions:
    try:
      question_collection.insert_one(
        {
          "book_name": subchapter.get("book_name"),
          "chapter_title": subchapter.get("chapter_title"),
          "subchapter_title": subchapter.get("subchapter_title"),
          "question": question["text"],
          "alternatives": question["alternatives"],
          "correct_alternative": question["correct_alternative"],
          "difficulty": question["difficulty"],
        })
    except Exception as e:
      print(f"Error inserting question into MongoDB: {e}")
    finally:
      print("Entry done")
      continue

@function_timer
def generate_questions(model_class, name, questions_per_chapter, difficulty_distribution):
  subchapters = get_subchapters(name) # Change to get local files / only one subchapter
  model = model_class
  print("Generating questions...")
  for subchapter in subchapters:
    try:
      generated_prompt = build_prompt(subchapter, questions_per_chapter, difficulty_distribution)
      response = model.generate_response(generated_prompt)
    except Exception as e:
      print(f"Error generating questions: {e}")
      exit()
    print(evaluate_response(response))
    questions = evaluate_response(response)
    insert_to_mongodb(questions, subchapter)
  print("Questions generated")

if __name__ == '__main__':
  delete_collection(question_collection)
  book_name = "The Elements of Statistical Learning"
  generate_questions(MistralModel(), book_name, questions_per_chapter, difficulty_distribution)