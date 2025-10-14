"""Book catalog mapping book identifiers to titles."""

BOOK_CATALOG = {
    "0": "Marketing of High-Technology Products and Innovations",
    "Marketing of High-Technology Products and Innovations": "0",
    
    "1": "Modern Mathematical Statistics with Applications Third Edition",
    "Modern Mathematical Statistics with Applications Third Edition": "1",
    
    "2": "New Korean Wave: Transnational Cultural Power in the Age of Social Media",
    "New Korean Wave: Transnational Cultural Power in the Age of Social Media": "2",
    
    "3": "Principles of Macroeconomics 3e",
    "Principles of Macroeconomics 3e": "3",
    
    "4": "The Elements of Statistical Learning",
    "The Elements of Statistical Learning": "4",
}


def get_book_title(identifier: str) -> str:
    """
    Get book title from identifier.
    
    Args:
        identifier: Book ID or title
        
    Returns:
        Book title
        
    Raises:
        KeyError: If book not found in catalog
    """
    if identifier not in BOOK_CATALOG:
        raise KeyError(f"Book '{identifier}' not found in catalog")
    return BOOK_CATALOG[identifier]


def get_book_id(title: str) -> str:
    """
    Get book ID from title.
    
    Args:
        title: Book title
        
    Returns:
        Book ID
        
    Raises:
        KeyError: If book not found in catalog
    """
    if title not in BOOK_CATALOG:
        raise KeyError(f"Book '{title}' not found in catalog")
    return BOOK_CATALOG[title]


def list_books() -> dict:
    """
    Get all books in catalog.
    
    Returns:
        Dictionary of book mappings
    """
    return BOOK_CATALOG.copy()