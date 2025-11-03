import os
from pymongo import MongoClient

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        _client = MongoClient(uri)
    return _client


def get_db():
    client = get_client()
    db_name = os.environ.get("MONGODB_DB", "gemscap")
    return client[db_name]


