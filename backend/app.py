from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Allow the frontend (opened as a local file) to talk to this server.
# flask-cors is a small, standard Flask extension — install with:
#   pip install flask flask-cors
CORS(app)

# ─── In-memory user store ───────────────────────────────────────────────────
# Key  : email address (string, lowercased)
# Value: dict with the user's stored password
#
# NOTE: passwords are stored in plain text here for simplicity.
# In a real app you would hash them with bcrypt or werkzeug.security.
users = {}


# ─── Helper ─────────────────────────────────────────────────────────────────
def error(message, status=400):
    """Return a JSON error response."""
    return jsonify({"success": False, "message": message}), status


def success(message, status=200):
    """Return a JSON success response."""
    return jsonify({"success": True, "message": message}), status


# ─── Routes ─────────────────────────────────────────────────────────────────

@app.route("/signup", methods=["POST"])
def signup():
    """
    Expects JSON body: { "email": "...", "password": "..." }
    Creates a new user if the email is not already taken.
    """
    data = request.get_json()

    # Validate that both fields were sent
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

    # Save the new user
    users[email] = {"password": password}
    return success("Account created! You can now log in.", status=201)


@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON body: { "email": "...", "password": "..." }
    Checks credentials and returns success or an error.
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


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # debug=True gives helpful error messages during development.
    # Never use debug=True in production.
    print("Flask server running at http://127.0.0.1:5000")
    app.run(debug=True)
