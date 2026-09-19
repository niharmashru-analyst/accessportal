import os
import sqlite3
import secrets
from functools import wraps
from flask import Flask, request, jsonify, session, redirect, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "portal.db"))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")

EKA_URL = os.environ.get("EKA_URL", "https://eka-ughi.onrender.com")
MT_URL = os.environ.get("MT_URL", "https://mt360db.onrender.com")
SECRET_KEY = os.environ.get("SECRET_KEY", "CHANGE_THIS_SECRET_KEY_IN_RENDER")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="/")
app.secret_key = SECRET_KEY
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = True

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            designation TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            eka_access INTEGER NOT NULL DEFAULT 0,
            mt_access INTEGER NOT NULL DEFAULT 0,
            is_admin INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_email TEXT,
            action TEXT,
            target_email TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (admin_email,)).fetchone()
    if not existing:
        conn.execute("""
            INSERT INTO users
            (name,email,designation,password_hash,eka_access,mt_access,is_admin,active)
            VALUES (?,?,?,?,1,1,1,1)
        """, (
            "Administrator", admin_email, "Admin",
            generate_password_hash(admin_password)
        ))
        conn.commit()
        print("Initial admin created:", admin_email)
    conn.close()

def public_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "designation": row["designation"],
        "eka_access": bool(row["eka_access"]),
        "mt_access": bool(row["mt_access"]),
        "is_admin": bool(row["is_admin"]),
        "active": bool(row["active"]),
        "created_at": row["created_at"],
    }

def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return row

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user or not user["active"] or not user["is_admin"]:
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    conn = db()
    row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    conn.close()

    if not row or not row["active"] or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session.clear()
    session["user_id"] = row["id"]

    destinations = []
    if row["eka_access"]:
        destinations.append({"key": "eka", "name": "EKA Analytics", "url": EKA_URL})
    if row["mt_access"]:
        destinations.append({"key": "mt", "name": "Modern Trade 360", "url": MT_URL})

    return jsonify({
        "user": public_user(row),
        "destinations": destinations,
        "eka_url": EKA_URL,
        "mt_url": MT_URL
    })

@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/me")
def me():
    row = current_user()
    if not row or not row["active"]:
        session.clear()
        return jsonify({"authenticated": False}), 401

    destinations = []
    if row["eka_access"]:
        destinations.append({"key": "eka", "name": "EKA Analytics", "url": EKA_URL})
    if row["mt_access"]:
        destinations.append({"key": "mt", "name": "Modern Trade 360", "url": MT_URL})

    return jsonify({
        "authenticated": True,
        "user": public_user(row),
        "destinations": destinations
    })

@app.get("/api/users")
@admin_required
def users():
    conn = db()
    rows = conn.execute("SELECT * FROM users ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify({"users": [public_user(r) for r in rows]})

@app.post("/api/users")
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    required = ["name", "email", "designation", "password"]
    if any(not str(data.get(k, "")).strip() for k in required):
        return jsonify({"error": "Name, email, designation and password are required"}), 400

    email = data["email"].strip().lower()
    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = db()
    try:
        conn.execute("""
            INSERT INTO users
            (name,email,designation,password_hash,eka_access,mt_access,is_admin,active)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            data["name"].strip(), email, data["designation"].strip(),
            generate_password_hash(data["password"]),
            int(bool(data.get("eka_access"))),
            int(bool(data.get("mt_access"))),
            int(bool(data.get("is_admin"))),
            int(data.get("active", True))
        ))
        conn.execute(
            "INSERT INTO audit_log(actor_email,action,target_email) VALUES(?,?,?)",
            (current_user()["email"], "CREATE_USER", email)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Email already exists"}), 409
    conn.close()
    return jsonify({"ok": True})

@app.put("/api/users/<int:user_id>")
@admin_required
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    name = str(data.get("name", row["name"])).strip()
    email = str(data.get("email", row["email"])).strip().lower()
    designation = str(data.get("designation", row["designation"])).strip()
    password = data.get("password")

    try:
        if password:
            if len(password) < 6:
                conn.close()
                return jsonify({"error": "Password must be at least 6 characters"}), 400
            conn.execute("""
                UPDATE users SET name=?,email=?,designation=?,password_hash=?,
                eka_access=?,mt_access=?,is_admin=?,active=?,updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (
                name,email,designation,generate_password_hash(password),
                int(bool(data.get("eka_access"))), int(bool(data.get("mt_access"))),
                int(bool(data.get("is_admin"))), int(bool(data.get("active", True))), user_id
            ))
        else:
            conn.execute("""
                UPDATE users SET name=?,email=?,designation=?,
                eka_access=?,mt_access=?,is_admin=?,active=?,updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (
                name,email,designation,
                int(bool(data.get("eka_access"))), int(bool(data.get("mt_access"))),
                int(bool(data.get("is_admin"))), int(bool(data.get("active", True))), user_id
            ))
        conn.execute(
            "INSERT INTO audit_log(actor_email,action,target_email) VALUES(?,?,?)",
            (current_user()["email"], "UPDATE_USER", email)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Email already exists"}), 409
    conn.close()
    return jsonify({"ok": True})

@app.delete("/api/users/<int:user_id>")
@admin_required
def delete_user(user_id):
    me_row = current_user()
    if me_row["id"] == user_id:
        return jsonify({"error": "You cannot delete your own account"}), 400

    conn = db()
    row = conn.execute("SELECT email FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.execute(
        "INSERT INTO audit_log(actor_email,action,target_email) VALUES(?,?,?)",
        (me_row["email"], "DELETE_USER", row["email"])
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.get("/api/audit")
@admin_required
def audit():
    conn = db()
    rows = conn.execute(
        "SELECT * FROM audit_log ORDER BY id DESC LIMIT 100"
    ).fetchall()
    conn.close()
    return jsonify({"logs": [dict(r) for r in rows]})

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    if FRONTEND_DIR and os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    index = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index):
        return send_from_directory(FRONTEND_DIR, "index.html")
    return jsonify({"error": "Frontend build not found"}), 404

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
