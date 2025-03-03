from pymongo import MongoClient
from openai import OpenAI
from PyPDF2 import PdfReader
import os
import requests
from dotenv import load_dotenv
from io import BytesIO
load_dotenv()

MONGO_client = MongoClient(os.getenv("MONGO_URI"))
Model_client = OpenAI(api_key=os.getenv("MODEL_API_KEY"), base_url="https://api.deepseek.com")
db = MONGO_client["bookTestMaker"]
subchapter_collection = db["subchapters"]
question_collection = db["questions"] 

questions_per_chapter = 8  # Change this value to adjust the number of questions per subchapter
difficulty_distribution = {"easy": 50, "medium": 25, "hard": 25}  # Adjust the difficulty percentages as needed

def delete_all_questions():
  question_collection.delete_many({})

delete_all_questions()

def get_subchapters(book_name):
  print("Getting subchapters...")
  subchapters = []
  for subchapter in subchapter_collection.find({"book_name": book_name}):
    pdf_url = subchapter.get("s3_link")
    book_name = subchapter.get("book_name")
    chapter_title = subchapter.get("chapter_title")
    subchapter_title = subchapter.get("subchapter_title")
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
  return subchapters

def build_prompt(subchapter, questions_per_chapter, difficulty_distribution):
  prompt = (
    f"Book: {subchapter.get('book_name')}\n"
    f"Chapter: {subchapter.get('chapter_title')}\n"
    f"Subchapter: {subchapter.get('subchapter_title')}\n\n"
    f"Text:\n{subchapter.get('text')}\n"
    f"Generate {questions_per_chapter} questions based on the above context.\n"
    "Each question should be on the following format:\n"
    "Question|||Alternative A|||Alternative A|||Alternative B|||Alternative C|||Alternative D|||Correct alternative|||Difficulty level \n"
    "Example: What is 2+2?|||3|||1|||4|||0|||C|||easy\n"
    "Questions are split by a new line\n"
    "Please distribute the questions following the specified difficulty distribution:\n"
  )
  for difficulty, percentage in difficulty_distribution.items():
    prompt += f"- {difficulty.capitalize()}: {percentage}% of the questions\n"
  prompt += "\nEnsure that the questions are clear, concise, and relevant to the provided content."
  return prompt

def insert_to_mongodb(response, subchapter):
  questions = response.split("\n")
  for question in questions:
    question_data = question.split("|||")
    print("inserting question...")
    try:
      question_collection.insert_one(
        {
          "book_name": subchapter.get("book_name"),
          "chapter_title": subchapter.get("chapter_title"),
          "subchapter_title": subchapter.get("subchapter_title"),
          "question": question_data[0],
          "alternatives": question_data[1:5],
          "correct_alternative": question_data[5],
          "difficulty": question_data[6],
        })
    except Exception as e:
      print(f"Error inserting question into MongoDB: {e}")
    finally:
      print("Entry done")
      continue

def generate_questions(book_name, questions_per_chapter, difficulty_distribution):
  subchapters = get_subchapters(book_name)
  for subchapter in subchapters[:1]:
    try:
      generated_prompt = build_prompt(subchapter, questions_per_chapter, difficulty_distribution)  # Assumes a helper function exists
      response = Model_client.chat.completions.create(
        model="deepseek-chat",
        messages=[
          {"role": "system", "content": "You are a helpful educational assistant."},
          {"role": "user", "content": generated_prompt},
        ],
        stream=False
      )
    except Exception as e:
      print(f"Error generating questions: {e}")
      exit()
    insert_to_mongodb(response.choices[0].message.content, subchapter)

if __name__ == '__main__':
  generate_questions("STKBoka", questions_per_chapter, difficulty_distribution)