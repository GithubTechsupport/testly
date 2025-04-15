import os
import PyPDF2
import fitz  # PyMuPDF
from dotenv import load_dotenv
import boto3
from pymongo import MongoClient
import book_titles

# Splitting pdfs into subchapters and uploading to S3 and MongoDB.

load_dotenv()

s3_client = boto3.client('s3')
bucket_name = os.getenv("AWS_BUCKET_NAME")

Mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = Mongo_client["bookTestMaker"] 
subchapter_collection = db["subchapters"]

exclude_terms = {
        "appendix", "abstract", "preface", "index",
        "cover", "title page", "acknowledgments",
        "about the author", "about the authors", "foreword",
        "prologue", "summary", "glossary", "contents", "copyrights", "copyright",
    }

def create_subchapter_partitions(pdf_path, book_name, exclude_terms=exclude_terms):
    print("Extracting TOC...")
    max_level = 2
    # Non-chapter keywords to filter out (all lower case)
    doc = fitz.open(pdf_path)
    toc = doc.get_toc()
    # First pass: record all entries and determine initial invalidity
    partitions = []
    prev = None
    parent = None
    parent_invalid = False
    for entry in toc:
        level, title, start_page = entry
        if level > max_level:
            continue

        if len(partitions) != 0 and partitions[-1]["subchapter_title"] == prev:
            partitions[-1]["end_page"] = start_page
        if level == 1:
            parent = (title)
            parent_invalid = False
        elif parent_invalid == True:
            prev = title
            continue
        # If deeper than max_level, automatically invalid (or we can just note it's beyond scope)
        title_lower = title.lower().strip()
        if any(term in title_lower for term in exclude_terms):
            if level == 1:
                parent_invalid = True
            prev = title
            continue
        prev = title
        partitions.append({"level": level, "book_name": book_name, "chapter_title": parent, "subchapter_title": title, "start_page":start_page, "end_page":None})
    print("TOC extraction complete")
    print(f"Total subchapters: {len(partitions)}")
    return partitions

def add_chapter_numbers(partitions):
    print("Adding chapter and subchapter numbers...")
    chapter_counter = 0
    subchapter_counter = 0
    for entry in partitions:
        if entry["level"] == 1:
            subchapter_counter = 0
            chapter_counter += 1
        subchapter_counter += 1
        entry["chapter_number"] = chapter_counter
        entry["subchapter_number"] = subchapter_counter
        
        
        #safe_sub_title = entry["sub_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","").replace("!","")
        #complete_output_path = os.path.join(output_path, safe_sub_title + ".pdf")
        #print(complete_output_path)
        #extract_pdf_range(book_path, complete_output_path, entry["start_page"], entry["end_page"])
    print("Added chapter and subchapter numbers")

def upload_to_s3(file_path, bucket_name, object_name):
    print(f"Uploading {file_path} to S3...")
    try:
        s3_client.upload_file(file_path, bucket_name, object_name)
        return f"https://{bucket_name}.s3.amazonaws.com/{object_name}"
    except Exception as e:
        print(f"Error uploading {file_path} to S3: {e}")
        exit()


def split_and_upload_pdfs(partitions, pdf_path):
    print("Splitting PDF into subchapters...")
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    
    for partition in partitions:
        pdf_writer = PyPDF2.PdfWriter()
        for page_num in range(partition["start_page"] - 1, partition["end_page"]):
            pdf_writer.add_page(pdf_reader.pages[page_num])
        
        safe_chap_title = partition["chapter_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","")
        safe_sub_title = partition["subchapter_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","")
        output_filename = f"{partition['book_name']}_Chapter_{safe_chap_title}_Subchapter_{safe_sub_title}.pdf"
        output_filename = output_filename.replace(" ", "_")
        output_dir = "/tmp"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        output_filepath = os.path.join(output_dir, output_filename)
        
        with open(output_filepath, "wb") as output_pdf:
            pdf_writer.write(output_pdf)
        
        s3_link = upload_to_s3(output_filepath, bucket_name, output_filename)
        if s3_link:
            try: 
                partition["s3_link"] = s3_link
                del partition["level"]
                subchapter_collection.insert_one(partition)
            except Exception as e:
                print(f"Failed to upload {output_filename} to MongoDB: {e}")
        print(f"Uploaded {output_filename} to S3")

    return partitions

def upload_book_info_to_mongo(book_title, partitions):
    print("Uploading book info to MongoDB...")
    try:
        book_info = {
            "book_title": book_title,
        }
        db["bookInfo"].insert_one(book_info)
        print("Book info uploaded to MongoDB")
    except Exception as e:
        print(f"Failed to upload book info to MongoDB: {e}")

def create_book_info(book_title, partitions):
    book_info = {
        "book_title": book_title,
        "subchapters": partitions
    }
    chapters = []
    chapter_subchapters = {}
    for partition in partitions:
        chapter = partition["chapter_title"]
        subchapter = partition["subchapter_title"]
        if chapter not in chapter_subchapters:
            chapters.append(chapter)
            chapter_subchapters[chapter] = []
        chapter_subchapters[chapter].append(subchapter)
    book_info["chapters"] = chapters
    book_info["chapter_subchapters"] = chapter_subchapters
    return book_info


if __name__ == "__main__":
    book_file_name = "0"
    book_title = book_titles.dictionary[book_file_name]
    book_path = f"..\\textbooks\{book_file_name}.pdf"
    partitions = create_subchapter_partitions(book_path, book_title)
    print(partitions)
    exit()
    add_chapter_numbers(partitions)
    split_and_upload_pdfs(partitions, book_path)
    #upload_book_info_to_mongo(book_title, partitions)