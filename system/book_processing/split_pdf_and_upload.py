import os
import PyPDF2
import fitz 
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
books_collection = db["books"]

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
    print("Added chapter and subchapter numbers")

def upload_to_s3(file_path, bucket_name, object_name):
    print(f"Uploading {file_path} to S3...")
    try:
        s3_client.upload_file(file_path, bucket_name, object_name)
        return f"https://{bucket_name}.s3.amazonaws.com/{object_name}"
    except Exception as e:
        print(f"Error uploading {file_path} to S3: {e}")
        exit()


def split_and_upload_pdfs(book_title, partitions, pdf_path):
    print("Splitting PDF into subchapters...")
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    subchapter_ids = []
    subchapter_infos = []

    chapter_infos = []
    chapter_first_index = 0
    
    for i, partition in enumerate(partitions):
        pdf_writer = PyPDF2.PdfWriter()
        for page_num in range(partition["start_page"] - 1, partition["end_page"]):
            pdf_writer.add_page(pdf_reader.pages[page_num])
        
        safe_chap_title = partition["chapter_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","").replace(">","-").replace("<","-")
        safe_sub_title = partition["subchapter_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","").replace(">","-").replace("<","-")
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
                result = subchapter_collection.insert_one(partition)
                subchapter_id = result.inserted_id
                subchapter_ids.append(subchapter_id)
                subchapter_infos.append([partition["subchapter_title"], partition["start_page"]])
            except Exception as e:
                print(f"Failed to upload {output_filename} to MongoDB: {e}")
        print(f"Uploaded {output_filename} to S3 and MongoDB")

        if i != len(partitions)-1:
            if partitions[i+1]["chapter_title"] != partition["chapter_title"]:
                chapter_infos.append([partition["chapter_title"], chapter_first_index, i])
                chapter_first_index = i + 1
        else:
            chapter_infos.append([partition["chapter_title"], chapter_first_index, i])

    try:
        print("Uploading book info...")
        book_info = {
            "book_title": book_title,
            "subchapter_ids": subchapter_ids,
            "subchapter_infos": subchapter_infos,
            "chapter_infos": chapter_infos
        }
        books_collection.insert_one(book_info)
    except Exception as e:
        print(f"Failed to upload {book_title} to MongoDB: {e}")        

    return partitions

if __name__ == "__main__":
    book_file_name = "4"
    book_title = book_titles.dictionary[book_file_name]
    book_path = f"..\\textbooks\{book_file_name}.pdf"
    partitions = create_subchapter_partitions(book_path, book_title)
    add_chapter_numbers(partitions)
    split_and_upload_pdfs(book_title, partitions, book_path)

