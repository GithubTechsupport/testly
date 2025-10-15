"""User document management module for handling uploaded PDFs."""

from typing import Dict, List, Optional
from bson import ObjectId
from pymongo.collection import Collection
from ..utils.database_funcs import get_mongo_client


class UserDocumentManager:
    """Manages user-uploaded documents in the system."""
    
    def __init__(self):
        """Initialize document manager with MongoDB connection."""
        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.uploaded_documents = self.db["uploaded_documents"]
        self.books_collection = self.db["books"]
        
    def get_document(self, document_id: str) -> Optional[Dict]:
        """
        Retrieve document by ID.
        
        Args:
            document_id: MongoDB ObjectId of document
            
        Returns:
            Document details or None if not found
        """
        try:
            return self.uploaded_documents.find_one({"_id": ObjectId(document_id)})
        except Exception as e:
            print(f"Error retrieving document: {e}")
            return None
            
    def list_documents(self, limit: int = 100) -> List[Dict]:
        """
        List all uploaded documents.
        
        Returns:
            List of document dictionaries
        """
        return list(self.uploaded_documents.find({}).limit(limit))
    
    def add_to_processing_queue(self, document_id: str) -> bool:
        """
        Mark document for processing.
        
        Args:
            document_id: MongoDB ObjectId of document
            
        Returns:
            Success status
        """
        try:
            result = self.uploaded_documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {"status": "queued_for_processing"}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error queueing document: {e}")
            return False
    
    def update_processing_status(
        self, 
        document_id: str, 
        status: str,
        error: Optional[str] = None
    ) -> bool:
        """
        Update document processing status.
        
        Args:
            document_id: MongoDB ObjectId of document
            status: Status string (processing, completed, failed)
            error: Optional error message
            
        Returns:
            Success status
        """
        try:
            update = {"status": status}
            if error:
                update["error"] = error
            
            result = self.uploaded_documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": update}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating document status: {e}")
            return False