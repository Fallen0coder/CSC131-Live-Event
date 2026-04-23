from flask import Flask, request, jsonify

app = Flask(__name__)

# ─── CORS ────────────────────────────────────────────────────────────────────
# When a browser opens an HTML file from disk (file://) and that page calls
# fetch("http://127.0.0.1:5000/..."), the browser blocks the response unless
# the server includes these headers.  We add them to EVERY response here so
# we don't need the flask-cors package at all.

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    return response

# Browsers send a preflight OPTIONS request before POST.
# This route handles it so Flask doesn't return 405 Method Not Allowed.
@app.route("/login",  methods=["OPTIONS"])
@app.route("/signup", methods=["OPTIONS"])
def handle_preflight():
    response = jsonify({})
    return response, 200


# ─── In-memory user store ────────────────────────────────────────────────────
# Key  : email address (lowercase string)
# Value: dict containing the user's password
#
# Data lives only while Flask is running — it resets on every restart.
# A real app would use a database instead.
users = {}


# ─── Helpers ─────────────────────────────────────────────────────────────────
def error(message, status=400):
    """Return a JSON error response."""
    return jsonify({"success": False, "message": message}), status


def success(message, status=200):
    """Return a JSON success response."""
    return jsonify({"success": True, "message": message}), status


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/signup", methods=["POST"])
def signup():
    """
    Expects JSON body:  { "email": "...", "password": "..." }
    Creates a new user if the email is not already taken.
    """
    data = request.get_json()

    if not data or "email" not in data or "password" not in data:
        return error("Email and password are required.")

    email    = data["email"].strip().lower()
    password = data["password"].strip()

    if not email or not password:
        return error("Email and password cannot be empty.")

    if len(password) < 6:
        return error("Password must be at least 6 characters.")

    if email in users:
        return error("An account with that email already exists.")

    users[email] = {"password": password}
    return success("Account created! You can now log in.", status=201)


@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON body:  { "email": "...", "password": "..." }
    Returns success if credentials match, otherwise an error.
    """
    data = request.get_json()

    if not data or "email" not in data or "password" not in data:
        return error("Email and password are required.")

    email    = data["email"].strip().lower()
    password = data["password"].strip()

    if email not in users:
        return error("No account found with that email.")

    if users[email]["password"] != password:
        return error("Incorrect password. Please try again.")

    return success(f"Welcome back! Logged in as {email}.")


# ─── Start the server ────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n  Live Event backend is running.")
    print("  Open: http://127.0.0.1:5001\n")
    app.run(debug=True, port=5001)
