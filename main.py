from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_httpauth import HTTPTokenAuth
from werkzeug.security import generate_password_hash, check_password_hash
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

# MongoDB setup
MONGO_URL = os.getenv("MONGODB_URL")
client = MongoClient(MONGO_URL)
db = client["quickdesk"]
users_collection = db["users"]
tickets_collection = db["tickets"]

# Password hashing

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
def register():
    data = request.get_json()
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
    return jsonify({"message": "User registered successfully", "user_id": str(result.inserted_id)})

# Auth: Login
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    user = users_collection.find_one({"email": data["email"]})
    if not user or not check_password_hash(user["password"], data["password"]):
        return jsonify({"message": "Invalid email or password"}), 401

    token = generate_token(user["_id"])
    user.pop("password")  # remove password
    user["id"] = str(user.pop("_id"))
    return jsonify({"token": token, "user": user})

# Create ticket
@app.route("/api/tickets", methods=["POST"])
@auth.login_required
def create_ticket():
    user = auth.current_user()
    subject = request.form.get("subject")
    description = request.form.get("description")
    category = request.form.get("category")
    priority = request.form.get("priority", "medium")

    attachment_path = None
    if "attachment" in request.files:
        file = request.files["attachment"]
        filename = f"uploads/{datetime.utcnow().timestamp()}_{file.filename}"
        os.makedirs("uploads", exist_ok=True)
        file.save(filename)
        attachment_path = filename

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
    ticket_doc["_id"] = result.inserted_id
    return jsonify({"message": "Ticket created", "ticket_id": str(result.inserted_id)})

# Get tickets
@app.route("/api/tickets", methods=["GET"])
@auth.login_required
def get_tickets():
    user = auth.current_user()
    if user["role"] == "user":
        tickets = list(tickets_collection.find({"created_by": user["_id"]}))
    else:
        tickets = list(tickets_collection.find())

    result = []
    for t in tickets:
        t["id"] = str(t.pop("_id"))
        t["created_by"] = str(t["created_by"])
        if t.get("assigned_to"):
            t["assigned_to"] = str(t["assigned_to"])
        result.append(t)
    return jsonify(result)

# Update ticket status
@app.route("/api/tickets/<ticket_id>/status", methods=["PATCH"])
@auth.login_required
def update_status(ticket_id):
    user = auth.current_user()
    if user["role"] == "user":
        return jsonify({"message": "Unauthorized"}), 403

    update = request.get_json()
    update_doc = {"updated_at": datetime.utcnow()}
    if "status" in update:
        update_doc["status"] = update["status"]
    if "assigned_to" in update:
        update_doc["assigned_to"] = ObjectId(update["assigned_to"])
    if "priority" in update:
        update_doc["priority"] = update["priority"]

    tickets_collection.update_one({"_id": ObjectId(ticket_id)}, {"$set": update_doc})
    return jsonify({"message": "Ticket updated"})

# Health check
@app.route("/api/health")
def health():
    try:
        db.command("ping")
        return {"status": "healthy", "timestamp": datetime.utcnow()}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

if __name__ == '__main__':
    app.run(host= '0.0.0.0', debug=True, port=5000)
