def update_collection(collection, field_to_change, old_value, new_value):
  print("Updating collection...")
  result = collection.update_many(
    {field_to_change: old_value},  
    {"$set": {field_to_change: new_value}}
  )
  print("Collection updated")

def delete_collection(collection):
  print("Deleting collection...")
  collection.delete_many({})
  print("Collection deleted")

def get_entry(collection, field, value):
  print("Getting entry...")
  entry = collection.find_one({field: value})
  print("Entry retrieved")
  return entry