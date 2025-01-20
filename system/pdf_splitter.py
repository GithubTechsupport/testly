import os
import PyPDF2
import fitz  # PyMuPDF
#from pymongo import MongoClient
#from dotenv import load_dotenv

#load_dotenv()

#client = MongoClient(os.getenv("MONGO_URI"))  
#db = client["bookTestMaker"] 
#collection = db["subchapters"] 

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
    for entry in toc:
        level, title, page = entry
        # If deeper than max_level, automatically invalid (or we can just note it's beyond scope)
        if level > max_level:
            is_invalid = True
        else:
            title_lower = title.lower().strip()
            is_invalid = any(term in title_lower for term in non_chapter_terms)
        
        entries.append((level, title, page, is_invalid))

    # Second pass: propagate invalidity from invalid top-level entries
    # If a top-level (level=1) entry is invalid, all subsequent entries of greater level
    # until the next top-level entry are also invalid.
    i = 0
    while i < len(entries):
        level, title, page, is_invalid = entries[i]

        # If we hit a top-level entry that is invalid, propagate
        if level == 1 and is_invalid:
            j = i + 1
            while j < len(entries) and entries[j][0] > 1:
                # Mark sub-chapters invalid
                l, t, p, inv = entries[j]
                entries[j] = (l, t, p, True)
                j += 1
        i += 1

    # Now build the partitions from all entries
    partitions = []
    for level, title, page, is_invalid in entries:
        partitions.append({
            "chapter_title": title,
            "chapter_level": level,
            "page_start": page,
            "page_end": None,
            "invalid": is_invalid
        })

    # Determine page_end for each partition
    for i in range(len(partitions)):
        current_level = partitions[i]["chapter_level"]
        current_page = partitions[i]["page_start"]
        end_page = doc.page_count

        for j in range(i+1, len(partitions)):
            next_level = partitions[j]["chapter_level"]
            next_page = partitions[j]["page_start"]
            if next_level <= current_level:
                end_page = next_page - 1
                break

        partitions[i]["page_end"] = end_page

    # Filter out invalid partitions
    final_partitions = []
    count = 0
    for p in partitions:
        if not p["invalid"]:
            if p["chapter_level"] == 1:
                count += 1
            final_partitions.append(p)
    final_partitions.append(count)

    # Print results for demonstration
    #for i in range(len(final_partitions) - 1):
    #    
    #    indent = "  " * (final_partitions[i]["chapter_level"] - 1)
    #    print(f"{indent}{final_partitions[i]['chapter_title']} (Start Page: {final_partitions[i]['page_start']}, End Page: {final_partitions[i]['page_end']})")
    #print("Number of main chapters: ", final_partitions[len(final_partitions)-1])
    return final_partitions

def extract_pdf_range(input_pdf, output_pdf, start_page, end_page):
    """
    Extracts pages from start_page through end_page (inclusive)
    from input_pdf, and saves them to output_pdf.
    
    :param input_pdf: Path to the input PDF file.
    :param output_pdf: Path where the extracted PDF should be saved.
    :param start_page: The first page of the range (1-based).
    :param end_page: The last page of the range (1-based).
    """
    with open(input_pdf, 'rb') as file_in:
        reader = PyPDF2.PdfReader(file_in)
        writer = PyPDF2.PdfWriter()

        # Note: PyPDF2 uses zero-based indexing for pages.
        # If the user says start_page=1, that means index 0 in PyPDF2.
        # So we subtract 1 to align with zero-based indexing.
        for page_num in range(start_page - 1, end_page):
            writer.add_page(reader.pages[page_num])

        with open(output_pdf, 'wb') as file_out:
            writer.write(file_out)

def split_into_pdfs(partitions, input_pdf, output_dir, book_name="MyBook", book_number=1):
    """
    Splits a PDF into multiple smaller PDFs based on the given partitions.
    Each partition is assumed to be a chapter or subchapter.
    
    :param partitions: A list of dicts, each with:
        - 'chapter_title'
        - 'chapter_level'
        - 'page_start'
        - 'page_end'
        - 'invalid'
      plus one extra element at the end that is just the count of main chapters 
      (based on your earlier code).
    :param input_pdf: Path to the input PDF file.
    :param output_dir: Directory where the split PDFs will be saved.
    :param book_name: The name of the book (for your entry object).
    :param book_number: The "book number" (for your entry object).
    """
    
    # The last element in `partitions` is the total count of main chapters.
    # We don't want to iterate over that integer, so let's separate it out.
    # (If your code is different, adjust accordingly.)
    if isinstance(partitions[-1], int):
        total_main_chapters = partitions[-1]
        partitions = partitions[:-1]
    else:
        total_main_chapters = None  # If it's missing, or you handle it differently

    # Make sure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    chapter_number = 0
    subchapter_number = 0

    # We'll keep a list of "entry" objects for demonstration or later usage
    entries_log = []

    # Helper function to safely find the next subchapter’s start page
    # if the next partition is indeed a subchapter (level 2).
    def find_next_subchapter_start(i):
        """Return the start page of the next partition if it is a subchapter."""
        if i + 1 < len(partitions):
            next_p = partitions[i + 1]
            if next_p["chapter_level"] == 2:
                return next_p["page_start"]
        return None

    i = 0
    while i < len(partitions):
        p = partitions[i]
        level = p["chapter_level"]
        chapter_title = p["chapter_title"]
        start_page = p["page_start"]
        end_page = p["page_end"]

        # If it's a main chapter
        if level == 1:
            chapter_number += 1
            # "Introduction" part => subchapter_number = 0
            subchapter_number = 0
            subchapter_name = chapter_title + " introduction"

            # Possibly limit the end_page to the next subchapter’s start_page - 1
            # if there *is* a next subchapter
            maybe_next_subchapter_start = find_next_subchapter_start(i)
            if maybe_next_subchapter_start:
                end_page = maybe_next_subchapter_start - 1

            # Build the "entry" object
            entry = {
                "book_name": book_name,
                "chapter_name": chapter_title,
                "subchapter_name": subchapter_name,
                "book_number": book_number,
                "chapter_number": chapter_number,
                "subchapter_number": subchapter_number,
            }
            entries_log.append(entry)

            # Create the output PDF filename (use subchapter name or something cleaner)
            # e.g., "Chapter1_Introduction.pdf"
            safe_filename = subchapter_name.replace(" ", "_") + ".pdf"
            output_pdf_path = os.path.join(output_dir, safe_filename)

            # Extract pages
            extract_pdf_range(input_pdf, output_pdf_path, start_page, end_page)

            # If the next partition is also level=1 or we are at the end, no more subchapters
            # so we move on to next partition
            # But if the next partition(s) are level=2, handle them in the loop below.
            
            i += 1

            # After we create the introduction part, we might have subchapters for this chapter
            # We only continue subchapters as long as the next partition is level=2
            while i < len(partitions) and partitions[i]["chapter_level"] == 2:
                subchapter_number += 1
                sub_p = partitions[i]
                sub_start = sub_p["page_start"]
                sub_end = sub_p["page_end"]
                sub_title = sub_p["chapter_title"]

                # Build entry object
                entry = {
                    "book_name": book_name,
                    "chapter_name": chapter_title,
                    "subchapter_name": sub_title,
                    "book_number": book_number,
                    "chapter_number": chapter_number,
                    "subchapter_number": subchapter_number,
                }
                entries_log.append(entry)

                # Construct the PDF filename
                safe_sub_filename = sub_title.replace(" ", "_") + ".pdf"
                output_sub_pdf_path = os.path.join(output_dir, safe_sub_filename)

                # Extract subchapter
                extract_pdf_range(input_pdf, output_sub_pdf_path, sub_start, sub_end)

                i += 1

        else:
            # If we encounter a level=2 partition without a preceding level=1,
            # handle or ignore as needed. In a typical well-structured TOC, 
            # this shouldn't happen unless the PDF has an unusual structure.
            #
            # For safety, just create a subchapter from it (though it has no main chapter).
            subchapter_number += 1

            subchapter_name = chapter_title
            entry = {
                "book_name": book_name,
                "chapter_name": f"UnknownChapter{chapter_number}",
                "subchapter_name": subchapter_name,
                "book_number": book_number,
                "chapter_number": chapter_number,
                "subchapter_number": subchapter_number,
            }
            entries_log.append(entry)

            safe_filename = subchapter_name.replace(" ", "_") + ".pdf"
            output_pdf_path = os.path.join(output_dir, safe_filename)

            extract_pdf_range(input_pdf, output_pdf_path, start_page, end_page)

            i += 1

    # If needed, return the entries log or any useful info
    return entries_log


book_path="Jakki.pdf"
partitions = extract_filtered_toc(book_path)
print(partitions)
#split_into_pdfs(partitions, book_path, "output")