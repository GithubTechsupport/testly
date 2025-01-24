import os
import PyPDF2
import fitz  # PyMuPDF
from dotenv import load_dotenv
import boto3
from pymongo import MongoClient

load_dotenv()

s3_client = boto3.client('s3')
bucket_name = os.getenv("AWS_BUCKET_NAME")

client = MongoClient(os.getenv("MONGO_URI"))  
db = client["bookTestMaker"] 
collection = db["subchapters"] 

def extract_filtered_toc(pdf_path, book_name):
    max_level = 2
    # Non-chapter keywords to filter out (all lower case)
    non_chapter_terms = {
        "appendix", "abstract", "preface", "index",
        "cover", "title page", "acknowledgments",
        "about the author", "about the authors", "foreword",
        "prologue", "summary", "glossary", "contents", "copyrights", "copyright",
    }

    doc = fitz.open(pdf_path)
    toc = doc.get_toc()

    # First pass: record all entries and determine initial invalidity
    entries = []
    prev = None
    parent = None
    parent_invalid = False
    for entry in toc:
        level, title, start_page = entry
        if level > max_level:
            continue

        if len(entries) != 0 and entries[-1]["subchapter_title"] == prev:
            entries[-1]["end_page"] = start_page
        if level == 1:
            parent = (title)
            parent_invalid = False
        elif parent_invalid == True:
            prev = title
            continue
        # If deeper than max_level, automatically invalid (or we can just note it's beyond scope)
        title_lower = title.lower().strip()
        if any(term in title_lower for term in non_chapter_terms):
            print(title)
            if level == 1:
                parent_invalid = True
            prev = title
            continue
        prev = title
        entries.append({"level": level, "book_name": book_name, "chapter_title": parent, "subchapter_title": title, "start_page":start_page, "end_page":None})

    return entries

def add_chapter_numbers(partitions):
    chapter_counter = 0
    subchapter_counter = 0
    for entry in partitions:
        entry["chapter_number"] = chapter_counter
        entry["subchapter_number"] = subchapter_counter
        subchapter_counter += 1
        if entry["level"] == 1:
            subchapter_counter = 0
            chapter_counter += 1
        #safe_sub_title = entry["sub_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","").replace("!","")
        #complete_output_path = os.path.join(output_path, safe_sub_title + ".pdf")
        #print(complete_output_path)
        #extract_pdf_range(book_path, complete_output_path, entry["start_page"], entry["end_page"])

def upload_to_s3(file_path, bucket_name, object_name):
    try:
        s3_client.upload_file(file_path, bucket_name, object_name)
        return f"https://{bucket_name}.s3.amazonaws.com/{object_name}"
    except Exception as e:
        print(f"Error uploading {file_path} to S3: {e}")
        return None


def split_into_pdfs(partitions, pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    
    for partition in partitions:
        pdf_writer = PyPDF2.PdfWriter()
        for page_num in range(partition["start_page"] - 1, partition["end_page"]):
            pdf_writer.add_page(pdf_reader.pages[page_num])
        
        safe_chap_title = partition["chapter_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","")
        safe_sub_title = partition["subchapter_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","")
        output_filename = f"{partition['book_name']}_Chapter_{safe_chap_title}_Subchapter_{safe_sub_title}.pdf"
        output_dir = "/tmp"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        output_filepath = os.path.join(output_dir, output_filename)
        
        with open(output_filepath, "wb") as output_pdf:
            pdf_writer.write(output_pdf)
        
        s3_link = upload_to_s3(output_filepath, bucket_name, output_filename)
        if s3_link:
            partition["s3_link"] = s3_link
            collection.insert_one(partition)
        else:
            print(f"Failed to upload {output_filename} to S3")

    return partitions

def upload_partitions_to_mongodb(partitions):
    for partition in partitions:
        del partition["level"]
        try:
            collection.insert_one(partition)
            print(f"Inserted partition: {partition['chapter_title']} into MongoDB")
        except Exception as e:
            print(f"Error inserting partition {partition['chapter_title']} into MongoDB: {e}")


if __name__ == "__main__":
    book_path = "Jakki.pdf"
    partitions = extract_filtered_toc(book_path, "Jakki")
    add_chapter_numbers(partitions)
    split_into_pdfs(partitions, book_path)
    upload_partitions_to_mongodb(partitions)