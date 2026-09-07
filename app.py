from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime, timedelta
import uuid

app = Flask(__name__)

DATA_FILE = "tasks.json"

# ----------------- Helper Functions -----------------
def load_tasks():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_tasks(tasks):
    with open(DATA_FILE, "w") as f:
        json.dump(tasks, f, indent=4)

def get_next_id(tasks):
    return max([t["id"] for t in tasks], default=0) + 1

# ----------------- Routes -----------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(load_tasks())

@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json()
    tasks = load_tasks()
    new_task = {
        "id": get_next_id(tasks),
        "uuid": str(uuid.uuid4()),
        "title": data.get("title", "").strip(),
        "description": data.get("description", "").strip(),
        "category": data.get("category", "General"),
        "priority": data.get("priority", "Medium"),
        "status": data.get("status", "todo"),
        "tags": data.get("tags", []),
        "due_date": data.get("due_date", ""),
        "reminder": data.get("reminder", ""),
        "subtasks": data.get("subtasks", []),
        "notes": data.get("notes", ""),
        "color": data.get("color", "blue"),
        "pinned": data.get("pinned", False),
        "archived": False,
        "completed": False,
        "progress": 0,
        "time_spent": 0,
        "estimated_time": data.get("estimated_time", 0),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    data = request.get_json()
    for key in ["title", "description", "category", "priority", "status",
                "tags", "due_date", "reminder", "subtasks", "notes",
                "color", "pinned", "completed", "progress", "time_spent",
                "estimated_time"]:
        if key in data:
            task[key] = data[key]
    task["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    save_tasks(tasks)
    return jsonify(task)

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [t for t in tasks if t["id"] != task_id]
    save_tasks(tasks)
    return jsonify({"message": "Deleted successfully"})

@app.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    task["completed"] = not task["completed"]
    task["status"] = "done" if task["completed"] else "todo"
    task["progress"] = 100 if task["completed"] else task.get("progress", 0)
    task["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    save_tasks(tasks)
    return jsonify(task)

@app.route("/api/tasks/<int:task_id>/pin", methods=["PATCH"])
def pin_task(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    task["pinned"] = not task.get("pinned", False)
    save_tasks(tasks)
    return jsonify(task)

@app.route("/api/tasks/<int:task_id>/archive", methods=["PATCH"])
def archive_task(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    task["archived"] = not task.get("archived", False)
    save_tasks(tasks)
    return jsonify(task)

@app.route("/api/tasks/<int:task_id>/subtask", methods=["POST"])
def add_subtask(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    data = request.get_json()
    if "subtasks" not in task:
        task["subtasks"] = []
    task["subtasks"].append({
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "completed": False
    })
    # Update progress
    total = len(task["subtasks"])
    done = sum(1 for s in task["subtasks"] if s["completed"])
    task["progress"] = int((done / total) * 100) if total > 0 else 0
    task["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    save_tasks(tasks)
    return jsonify(task)

@app.route("/api/tasks/<int:task_id>/subtask/<sub_id>/toggle", methods=["PATCH"])
def toggle_subtask(task_id, sub_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    sub = next((s for s in task.get("subtasks", []) if s["id"] == sub_id), None)
    if sub:
        sub["completed"] = not sub["completed"]
        total = len(task["subtasks"])
        done = sum(1 for s in task["subtasks"] if s["completed"])
        task["progress"] = int((done / total) * 100) if total > 0 else 0
        save_tasks(tasks)
    return jsonify(task)

@app.route("/api/stats", methods=["GET"])
def get_stats():
    tasks = load_tasks()
    active = [t for t in tasks if not t.get("archived", False)]
    completed = [t for t in tasks if t.get("completed", False)]
    pending = [t for t in tasks if not t.get("completed", False) and not t.get("archived", False)]

    # Tasks by category
    categories = {}
    for t in active:
        cat = t.get("category", "General")
        categories[cat] = categories.get(cat, 0) + 1

    # Tasks by priority
    priorities = {"Low": 0, "Medium": 0, "High": 0}
    for t in pending:
        priorities[t.get("priority", "Medium")] = priorities.get(t.get("priority", "Medium"), 0) + 1

    # Tasks by status
    statuses = {"todo": 0, "in_progress": 0, "review": 0, "done": 0}
    for t in active:
        statuses[t.get("status", "todo")] = statuses.get(t.get("status", "todo"), 0) + 1

    # Today's tasks
    today = datetime.now().strftime("%Y-%m-%d")
    today_tasks = [t for t in active if t.get("due_date") == today]

    # Overdue tasks
    overdue = []
    for t in pending:
        if t.get("due_date") and t["due_date"] < today:
            overdue.append(t)

    # Upcoming (next 7 days)
    upcoming = []
    for i in range(1, 8):
        date = (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d")
        for t in pending:
            if t.get("due_date") == date:
                upcoming.append(t)

    return jsonify({
        "total": len(tasks),
        "active": len(active),
        "completed": len(completed),
        "pending": len(pending),
        "today": len(today_tasks),
        "overdue": len(overdue),
        "upcoming": len(upcoming),
        "categories": categories,
        "priorities": priorities,
        "statuses": statuses,
        "completion_rate": int((len(completed) / len(tasks)) * 100) if tasks else 0
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)