from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_httpauth import HTTPTokenAuth
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import jwt
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)
auth = HTTPTokenAuth(scheme="Bearer")

# Secret key for JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
app.config['SECRET_KEY'] = SECRET_KEY

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# MongoDB setup with error handling
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
mongo_client = None
db = None
users_collection = None
tickets_collection = None

try:
    mongo_client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    # Test the connection
    mongo_client.server_info()
    db = mongo_client["Quickdesk"]
    users_collection = db["users"]
    tickets_collection = db["tickets"]
    print("Successfully connected to MongoDB")
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")
    print("Please ensure MongoDB is installed and running, or configure MongoDB Atlas in your .env file")
    # Initialize with None values to prevent startup errors
    db = None
    users_collection = None
    tickets_collection = None

def check_database_connection():
    """Check if database is properly connected"""
    return db is not None and users_collection is not None and tickets_collection is not None

def require_database(f):
    """Decorator to check database connection before executing function"""
    def wrapper(*args, **kwargs):
        if not check_database_connection():
            return jsonify({"message": "Database connection failed. Please check your MongoDB installation or configuration."}), 500
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# JWT Token generation
def generate_token(user_id):
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


# Auth: Get current user from token
@auth.verify_token
def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user = users_collection.find_one({"_id": ObjectId(payload["sub"])})
        return user
    except:
        return None

# Auth: Register
@app.route("/api/auth/register", methods=["POST"])
@require_database
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400
            
        if users_collection.find_one({"email": data["email"]}):
            return jsonify({"message": "Email already registered"}), 400

        user_doc = {
            "name": data["name"],
            "email": data["email"],
            "password": generate_password_hash(data["password"]),
            "role": data.get("role", "user"),
            "created_at": datetime.utcnow()
        }
        result = users_collection.insert_one(user_doc)
        return jsonify({"message": "User registered successfully", "user_id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"message": f"Registration failed: {str(e)}"}), 500

# Auth: Login
@app.route("/api/auth/login", methods=["POST"])
@require_database
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400
            
        user = users_collection.find_one({"email": data["email"]})
        if not user or not check_password_hash(user["password"], data["password"]):
            return jsonify({"message": "Invalid email or password"}), 401

        token = generate_token(user["_id"])
        user.pop("password")  # remove password
        user["id"] = str(user.pop("_id"))
        return jsonify({"token": token, "user": user}), 200
    except Exception as e:
        return jsonify({"message": f"Login failed: {str(e)}"}), 500

# Create ticket
@app.route("/api/tickets", methods=["POST"])
@auth.login_required
@require_database
def create_ticket():
    try:
        user = auth.current_user()
        subject = request.form.get("subject")
        description = request.form.get("description")
        category = request.form.get("category")
        priority = request.form.get("priority", "medium")

        # Validate required fields
        if not subject or not description or not category:
            return jsonify({"message": "Subject, description, and category are required"}), 400

        attachment_path = None
        if "attachment" in request.files:
            file = request.files["attachment"]
            if file and file.filename:
                filename = secure_filename(file.filename)
                filename = f"{datetime.utcnow().timestamp()}_{filename}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                attachment_path = file_path

        ticket_doc = {
            "subject": subject,
            "description": description,
            "category": category,
            "priority": priority,
            "status": "Open",
            "created_by": user["_id"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "assigned_to": None,
            "replies": [],
            "attachment": attachment_path
        }
        result = tickets_collection.insert_one(ticket_doc)
        return jsonify({"message": "Ticket created", "ticket_id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"message": f"Failed to create ticket: {str(e)}"}), 500

# Get tickets
@app.route("/api/tickets", methods=["GET"])
@auth.login_required
@require_database
def get_tickets():
    try:
        user = auth.current_user()
        if user["role"] == "user":
            tickets = list(tickets_collection.find({"created_by": user["_id"]}))
        else:
            tickets = list(tickets_collection.find())

        result = []
        for t in tickets:
            # Convert ObjectId to string for JSON serialization
            t["id"] = str(t.pop("_id"))
            t["created_by"] = str(t["created_by"]) if t["created_by"] else None
            if t.get("assigned_to"):
                t["assigned_to"] = str(t["assigned_to"])
            # Convert datetime objects to strings
            if t.get("created_at"):
                t["created_at"] = t["created_at"].isoformat()
            if t.get("updated_at"):
                t["updated_at"] = t["updated_at"].isoformat()
            # Convert reply datetime objects to strings
            if "replies" in t:
                for reply in t["replies"]:
                    if "created_at" in reply and isinstance(reply["created_at"], datetime):
                        reply["created_at"] = reply["created_at"].isoformat()
            result.append(t)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": f"Failed to retrieve tickets: {str(e)}"}), 500

# Update ticket status
@app.route("/api/tickets/<ticket_id>/status", methods=["PATCH"])
@auth.login_required
@require_database
def update_status(ticket_id):
    try:
        user = auth.current_user()
        if user["role"] == "user":
            return jsonify({"message": "Unauthorized"}), 403

        update = request.get_json()
        if not update:
            return jsonify({"message": "No update data provided"}), 400

        update_doc = {"updated_at": datetime.utcnow()}
        if "status" in update:
            update_doc["status"] = update["status"]
        if "assigned_to" in update and update["assigned_to"]:
            update_doc["assigned_to"] = ObjectId(update["assigned_to"])
        if "priority" in update:
            update_doc["priority"] = update["priority"]

        result = tickets_collection.update_one(
            {"_id": ObjectId(ticket_id)}, 
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            return jsonify({"message": "Ticket not found"}), 404
            
        return jsonify({"message": "Ticket updated"}), 200
    except Exception as e:
        return jsonify({"message": f"Failed to update ticket: {str(e)}"}), 500

# Add reply to ticket
@app.route("/api/tickets/<ticket_id>/reply", methods=["POST"])
@auth.login_required
@require_database
def add_reply(ticket_id):
    try:
        user = auth.current_user()
        data = request.get_json()
        
        if not data or "message" not in data:
            return jsonify({"message": "Message is required"}), 400

        # Create reply object
        reply = {
            "user": {
                "id": str(user["_id"]),
                "name": user["name"]
            },
            "message": data["message"],
            "created_at": datetime.utcnow()
        }

        # Add reply to ticket
        result = tickets_collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$push": {"replies": reply}}
        )
        
        if result.matched_count == 0:
            return jsonify({"message": "Ticket not found"}), 404
            
        return jsonify({"message": "Reply added successfully"}), 200
    except Exception as e:
        return jsonify({"message": f"Failed to add reply: {str(e)}"}), 500

# Health check
@app.route("/api/health")
def health():
    try:
        if not check_database_connection():
            return {"status": "unhealthy", "error": "Database connection failed"}
        db.command("ping")
        return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
 