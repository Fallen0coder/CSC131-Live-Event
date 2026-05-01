// Simple Node.js + Express backend for the Live Event project.
// In-memory data only (no database yet). Restarting the server resets the data.

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Allow the frontend (running on a different origin/port) to call this API.
app.use(cors());

// Parse JSON bodies on POST requests so we can read req.body.
app.use(express.json());

// ---------------------------------------------------------------------------
// Sample in-memory data
// ---------------------------------------------------------------------------

// A list of registered users. New signups get pushed onto this array.
const users = [
  { id: 1, name: "Alice", email: "alice@example.com", password: "password123" },
  { id: 2, name: "Bob",   email: "bob@example.com",   password: "password123" },
];

// A list of upcoming events the site can show.
const events = [
  {
    id: 1,
    title: "Campus Hack Night",
    date: "2026-05-15",
    location: "Engineering Building",
    description: "Build projects and meet other students.",
  },
  {
    id: 2,
    title: "Spring Concert",
    date: "2026-06-01",
    location: "Main Quad",
    description: "Live music and food trucks.",
  },
];

// A list of RSVPs. Each RSVP links a userId to an eventId.
const rsvps = [
  { id: 1, userId: 1, eventId: 1 },
  { id: 2, userId: 2, eventId: 1 },
];

// Counters used to generate the next id for new users and rsvps.
let nextUserId = 3;
let nextRsvpId = 3;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/events
// Returns the full list of events so the frontend can display them.
app.get("/api/events", (req, res) => {
  res.json(events);
});

// POST /api/signup
// Registers a new user. Expects JSON body: { name, email, password }.
// Rejects duplicate emails. Returns the new user (without the password).
app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Please provide name, email, and password." });
  }

  const emailTaken = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
  if (emailTaken) {
    return res.status(409).json({ error: "That email is already registered." });
  }

  const newUser = {
    id: nextUserId++,
    name,
    email,
    password,
  };
  users.push(newUser);

  res.status(201).json({
    message: "Signup successful.",
    user: { id: newUser.id, name: newUser.name, email: newUser.email },
  });
});

// POST /api/login
// Logs a user in. Expects JSON body: { email, password }.
// If the email/password match a user, returns that user (without the password).
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Please provide email and password." });
  }

  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  res.json({
    message: "Login successful.",
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// POST /api/rsvp
// Records an RSVP. Expects JSON body: { userId, eventId }.
// Validates that the user and event both exist, and prevents duplicate RSVPs.
app.post("/api/rsvp", (req, res) => {
  const userId = Number(req.body.userId);
  const eventId = Number(req.body.eventId);

  if (!userId || !eventId) {
    return res.status(400).json({ error: "Please provide userId and eventId." });
  }

  const userExists = users.some((u) => u.id === userId);
  const eventExists = events.some((e) => e.id === eventId);

  if (!userExists) return res.status(404).json({ error: "User not found." });
  if (!eventExists) return res.status(404).json({ error: "Event not found." });

  const alreadyRsvped = rsvps.some((r) => r.userId === userId && r.eventId === eventId);
  if (alreadyRsvped) {
    return res.status(200).json({ message: "You have already RSVP'd to this event." });
  }

  const newRsvp = { id: nextRsvpId++, userId, eventId };
  rsvps.push(newRsvp);

  res.status(201).json({ message: "RSVP saved.", rsvp: newRsvp });
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log("Server running on http://localhost:3000");
});
