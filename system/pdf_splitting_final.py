import os
import PyPDF2
import fitz  # PyMuPDF

def extract_filtered_toc(pdf_path):
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

        if len(entries) != 0 and entries[-1]["sub_title"] == prev:
            entries[-1]["end_page"] = start_page - 1
            if entries[-1]["end_page"] < entries[-1]["start_page"]:
                entries[-1]["end_page"] = entries[-1]["start_page"]
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
        entries.append({"level": level, "chap_title": parent, "sub_title": title, "start_page":start_page, "end_page":None})

    return entries

def extract_pdf_range(input_path, output_path, start_page, end_page):
    with open(input_path, 'rb') as file_in:
        reader = PyPDF2.PdfReader(file_in)
        writer = PyPDF2.PdfWriter()

        # Note: PyPDF2 uses zero-based indexing for pages.
        # If the user says start_page=1, that means index 0 in PyPDF2.
        # So we subtract 1 to align with zero-based indexing.
        for page_num in range(start_page - 1, end_page):
            writer.add_page(reader.pages[page_num])

        try:
            with open(output_path, 'wb') as file_out:
                writer.write(file_out)
        except:
            return

def split_into_pdfs(partitions, book_path, output_path):
    for entry in partitions[-3:]:
        safe_sub_title = entry["sub_title"].replace(":", "-").replace("/", "-").replace("\\", "-").replace("?","")
        complete_output_path = os.path.join(output_path, safe_sub_title + ".pdf")
        print(complete_output_path)
        extract_pdf_range(book_path, complete_output_path, entry["start_page"], entry["end_page"])

book_name = "Jakki"
book_path="Jakki.pdf"
partitions = extract_filtered_toc(book_path)
print(partitions)
split_into_pdfs(partitions, book_path, "output")