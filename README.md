# 🧠 QuickDesk – Modern Helpdesk Ticketing System

QuickDesk is a full-stack web application built for the **Odoo x CGC Hackathon 2025**. It streamlines support ticket management for users, agents, and admins through an intuitive interface and powerful backend logic.

---

## 🎯 Problem Statement

> Design a simple yet effective help desk system where users can raise tickets, and support agents/admins can manage and resolve them. Focus on usability, clean design, and robust workflows.

---

## 🚀 Live Features

### 👥 Authentication
- Register/Login with role: **User**, **Agent**, or **Admin**
- Role-based access control with dashboard customization

### 📩 Ticket Management
- Create new support tickets with subject, description, and category
- Optional attachment upload
- View ticket status, thread replies, and history

### 📊 Agent/Admin View
- View all tickets
- Change ticket status (Open → In Progress → Resolved → Closed)
- Assign and filter tickets
- Reply and manage user queries

### 🛠 User Dashboard
- Personalized stats: total tickets, resolved, assigned
- Filter/search tickets by status or category
- View real-time updates via notifications

---

## 🛠 Tech Stack

| Layer        | Tech                                |
|--------------|-------------------------------------|
| **Frontend** | HTML, CSS (Custom + Tailwind), JavaScript |
| **Backend**  | Python (FastAPI)                    |
| **Database** | SQLite                              |
| **API Auth** | JWT-based authentication            |

---

## 📁 Project Structure

📂 quickdesk/
├── main.py                  # FastAPI entry point
├── index.html               # Main dashboard + ticket view
├── Home.html                # Landing page
├── scripts.js               # Frontend logic and API handling
├── Home.css                 # Styling for landing page
└── Style.css                # (Assumed) styles for dashboard UI



---

## 📷 Screenshots


![ss](https://github.com/user-attachments/assets/ce197056-0cd0-4e88-a4c5-d4a2ea2a5395)

![ss2](https://github.com/user-attachments/assets/eec708b7-4e1e-439f-b07f-a1f60af1f5d9)

