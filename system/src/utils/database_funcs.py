"""Database utility functions for MongoDB operations."""

import os
from typing import Any, Optional
from pymongo import MongoClient
from pymongo.collection import Collection
from dotenv import load_dotenv

load_dotenv()


def get_mongo_client() -> MongoClient:
    """
    Get MongoDB client instance.
    
    Returns:
        MongoClient instance
    """
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise ValueError("MONGO_URI not found in environment variables")
    return MongoClient(mongo_uri)


def update_collection(
    collection: Collection,
    field_to_change: str,
    old_value: Any,
    new_value: Any
) -> int:
    """
    Update documents in collection.
    
    Args:
        collection: MongoDB collection
        field_to_change: Field name to update
        old_value: Current value to match
        new_value: New value to set
        
    Returns:
        Number of documents modified
    """
    print(f"Updating collection '{collection.name}'...")
    result = collection.update_many(
        {field_to_change: old_value},
        {"$set": {field_to_change: new_value}}
    )
    print(f"Updated {result.modified_count} documents")
    return result.modified_count


def delete_collection(collection: Collection) -> int:
    """
    Delete all documents from collection.
    
    Args:
        collection: MongoDB collection
        
    Returns:
        Number of documents deleted
    """
    print(f"Deleting all documents from '{collection.name}'...")
    result = collection.delete_many({})
    print(f"Deleted {result.deleted_count} documents")
    return result.deleted_count


def delete_entries(collection: Collection, field: str, value: Any) -> int:
    """
    Delete specific entries from collection.
    
    Args:
        collection: MongoDB collection
        field: Field name to match
        value: Value to match
        
    Returns:
        Number of documents deleted
    """
    print(f"Deleting entries where {field}={value}...")
    result = collection.delete_many({field: value})
    print(f"Deleted {result.deleted_count} documents")
    return result.deleted_count


def get_entry_single(collection: Collection, field: str, value: Any) -> Optional[dict]:
    """
    Get single entry from collection.
    
    Args:
        collection: MongoDB collection
        field: Field name to match
        value: Value to match
        
    Returns:
        Document dictionary or None if not found
    """
    print(f"Getting entry where {field}={value}...")
    entry = collection.find_one({field: value})
    if entry:
        print("Entry retrieved")
    else:
        print("Entry not found")
    return entry


def get_entries(collection: Collection, field: str, value: Any) -> list:
    """
    Get multiple entries from collection.
    
    Args:
        collection: MongoDB collection
        field: Field name to match
        value: Value to match
        
    Returns:
        List of document dictionaries
    """
    print(f"Getting entries where {field}={value}...")
    entries = list(collection.find({field: value}))
    print(f"Retrieved {len(entries)} entries")
    return entries


def create_vector_index(
    collection: Collection,
    index_name: str = "vector_index",
    path: str = "embedding",
    dimensions: int = 1024,
    similarity: str = "cosine"
) -> None:
    """
    Create vector search index for embeddings.
    
    Args:
        collection: MongoDB collection
        index_name: Name of the index
        path: Field containing vector embeddings
        dimensions: Dimensionality of embeddings
        similarity: Similarity metric (cosine, euclidean, dotProduct)
    """
    print(f"Creating vector index '{index_name}' on '{collection.name}'...")
    try:
        collection.create_search_index({
            "name": index_name,
            "definition": {
                "mappings": {
                    "dynamic": True,
                    "fields": {
                        path: {
                            "type": "knnVector",
                            "dimensions": dimensions,
                            "similarity": similarity
                        }
                    }
                }
            }
        })
        print("Vector index created successfully")
    except Exception as e:
        print(f"Error creating vector index: {e}")