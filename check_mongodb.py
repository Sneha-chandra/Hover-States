#!/usr/bin/env python3
"""
Script to check if MongoDB is installed and running.
"""

import pymongo
import sys
import os

def check_mongodb():
    """Check if MongoDB is installed and running."""
    print("Checking MongoDB installation and connection...")
    print("=" * 50)
    
    # Check if pymongo is installed
    try:
        import pymongo
        print("✓ pymongo is installed")
    except ImportError:
        print("✗ pymongo is not installed")
        print("  Please install it with: pip install pymongo")
        return False
    
    # Check if MongoDB is running locally
    try:
        # Try to connect to local MongoDB
        client = pymongo.MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
        client.server_info()  # Will throw an exception if can't connect
        print("✓ MongoDB is running locally")
        print("  Connection to localhost:27017 successful")
        
        # Try to create a test database and collection
        db = client['test_db']
        collection = db['test_collection']
        collection.insert_one({'test': 'document'})
        print("✓ MongoDB read/write test successful")
        
        # Clean up test data
        client.drop_database('test_db')
        print("✓ Test database cleaned up")
        
        return True
    except pymongo.errors.ServerSelectionTimeoutError:
        print("✗ Could not connect to MongoDB at localhost:27017")
        print("  Please ensure MongoDB is installed and running")
        print("  You can:")
        print("  1. Install MongoDB locally from https://www.mongodb.com/try/download/community")
        print("  2. Use MongoDB Atlas (cloud MongoDB) - see MONGODB_ATLAS_GUIDE.md")
        return False
    except Exception as e:
        print(f"✗ Error connecting to MongoDB: {e}")
        return False

def check_env_file():
    """Check if .env file exists and has MongoDB URL."""
    print("\nChecking .env file...")
    print("=" * 30)
    
    if os.path.exists('.env'):
        print("✓ .env file found")
        with open('.env', 'r') as f:
            content = f.read()
            if 'MONGODB_URL' in content:
                print("✓ MONGODB_URL found in .env")
                # Try to extract the URL
                for line in content.split('\n'):
                    if line.startswith('MONGODB_URL='):
                        url = line.split('=', 1)[1]
                        print(f"  URL: {url}")
                        return True
        print("✗ MONGODB_URL not found in .env")
        return False
    else:
        print("✗ .env file not found")
        print("  Please create a .env file with MONGODB_URL")
        return False

def main():
    """Main function to check MongoDB setup."""
    print("QuickDesk MongoDB Setup Checker")
    print("=" * 40)
    
    # Check .env file
    env_ok = check_env_file()
    
    # Check MongoDB connection
    mongo_ok = check_mongodb()
    
    print("\nSummary")
    print("=" * 15)
    print(f".env file: {'✓ OK' if env_ok else '✗ Missing/Misconfigured'}")
    print(f"MongoDB: {'✓ OK' if mongo_ok else '✗ Not accessible'}")
    
    if env_ok and mongo_ok:
        print("\n✓ All checks passed! You're ready to run QuickDesk.")
        return 0
    else:
        print("\n✗ Some checks failed. Please address the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
