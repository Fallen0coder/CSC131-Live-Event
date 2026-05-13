require("dotenv").config({ path: require("path").join(__dirname, ".env") });

// Node.js + Express backend for the Live Event project.
// Persistent storage: MongoDB through Mongoose (schemas live in backend/models/).
//
// Big picture:
// - REST endpoints below answer `fetch(...)` calls from the static/frontend bundle.
// - Passwords stay hashed server-side (`bcrypt`); login/signup routes return trimmed user JSON,
//   and the frontend often caches that JSON in localStorage — but edits/deletes still re-hit the DB
//   using username/email fields in the POST body instead of blindly trusting UI state.
// - Socket.IO attaches to the same HTTP server below for instant DMs/group messages (`newMessage`, etc.).
//
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const User = require("./models/User");
const Event = require("./models/Event");
const Comment = require("./models/Comment");
const RSVP = require("./models/RSVP");
const FriendRequest = require("./models/FriendRequest");
const Message = require("./models/Message");
const GroupChat = require("./models/GroupChat");
const GroupChatMessage = require("./models/GroupChatMessage");

// =========================
// APP + SHARED HTTP SERVER
// =========================
// Express serves JSON APIs only in this codebase (no SPA static-from-same-server here).
// `http.Server` wraps Express so Socket.IO can upgrade browsers to realtime channels on the same port.
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Socket.IO helper: receivers join rooms named exactly `user:<lowercaseUsername>`.
function userRoom(usernameLower) {
  return "user:" + usernameLower;
}

// Socket.IO helper: broadcasts land in rooms named `group:<mongoId>` after clients emit `join-group`.
function groupRoom(groupId) {
  return "group:" + String(groupId);
}

// =========================
// SOCKET.IO (REALTIME CHAT NOTIFY)
// =========================
// What: Opens long-lived websocket connections alongside REST.
// Why: Immediate UI updates instead of polling GET /messages every second.
//
// Frontend contract (matches script.js):
// - Direct messages: POST /api/messages saves Mongo first, then emits `newMessage`
//   to Socket.IO room `user:<receiverLowercaseUsername>` if that client ran `socket.emit("join", username)` (or handshake `?username=`).
// - Group chat: browsers call `socket.emit("join-group", groupId)`; POST /groupchats/:id/messages emits
//   `newGroupMessage`, member add/remove emits `groupMemberChange`.
//
io.on("connection", (socket) => {
  console.log("[socket] client connected:", socket.id);
  // Optional handshake join: io(".../?username=alice")
  const handshakeUsername = normalizeUsername(socket.handshake.query.username);
  if (handshakeUsername) {
    socket.join(userRoom(handshakeUsername));
    console.log(
      "[socket] handshake joined room:",
      userRoom(handshakeUsername),
      "socket:",
      socket.id
    );
  }

  // Frontend emits "join" with the logged-in username so this socket receives `newMessage` for that inbox.
  socket.on("join", (username) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return;
    socket.join(userRoom(normalized));
    console.log(
      "[socket] join event:",
      normalized,
      "room:",
      userRoom(normalized),
      "socket:",
      socket.id
    );
  });

  // Backward-compatible explicit registration payload.
  socket.on("register-user", (payload) => {
    const normalized = normalizeUsername(payload && payload.username);
    if (!normalized) return;
    socket.join(userRoom(normalized));
    console.log(
      "[socket] register-user event:",
      normalized,
      "room:",
      userRoom(normalized),
      "socket:",
      socket.id
    );
  });

  // Frontend: entering a group thread view should emit this once so `newGroupMessage` events arrive live.
  socket.on("join-group", (groupId) => {
    if (!groupId) return;
    socket.join(groupRoom(groupId));
    console.log(
      "[socket] join-group event:",
      groupId,
      "room:",
      groupRoom(groupId),
      "socket:",
      socket.id
    );
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] client disconnected:", socket.id, "reason:", reason);
  });
});

// =========================
// CORE EXPRESS MIDDLEWARE
// =========================
// cors(): allows the frontend dev server (often another localhost port) to call this API.
// express.json({ limit }): parses JSON POST bodies — large limit so Base64 avatars survive (PUT /picture).
//
app.use(cors());
// We allow a generous JSON body size because the profile picture route
// (PUT /api/profile/:username/picture) accepts Base64 image strings,
// which are roughly 33% larger than the original file. Express's default
// limit of 100kb is too small for typical avatar uploads, so we bump it
// to 10mb to comfortably fit a few-MB image.
app.use(express.json({ limit: "10mb" }));

// =========================
// DATABASE: CONNECT TO MONGODB
// =========================
// Start-up guard: refuses to boot without backend/.env + MONGO_URI so we never silently run stateless RAM-only.
//
if (!MONGO_URI) {
  const envPath = path.join(__dirname, ".env");
  console.error("MONGO_URI is not set.");
  console.error(`  Looked for env file at: ${envPath}`);
  if (fs.existsSync(envPath)) {
    const size = fs.statSync(envPath).size;
    console.error(`  File exists, size: ${size} bytes.`);
    if (size === 0) {
      console.error(
        "  The file is empty. Save your editor buffer and ensure it contains a line like:"
      );
      console.error("    MONGO_URI=mongodb+srv://...");
    } else {
      console.error("  The file has content but no MONGO_URI key was parsed.");
      console.error("  Make sure line 1 starts with: MONGO_URI=");
    }
  } else {
    console.error("  File does not exist. Create backend/.env with MONGO_URI=...");
  }
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    await seedEvents();
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// Convenience seed for empty demo DB — GET /api/events always returns something usable on stage / first boot.
async function seedEvents() {
  try {
    const count = await Event.estimatedDocumentCount();
    if (count > 0) return;

    const sampleEvents = [
      {
        title: "Campus Hack Night",
        date: "2026-05-15",
        time: "18:00",
        location: "Engineering Building",
        category: "tech",
        description: "Build projects and meet other students.",
        creatorUsername: "",
      },
      {
        title: "Spring Concert",
        date: "2026-06-01",
        time: "19:30",
        location: "Main Quad",
        category: "music",
        description: "Live music and food trucks.",
        creatorUsername: "",
      },
      {
        title: "Career Fair",
        date: "2026-06-10",
        time: "10:00",
        location: "Student Union Ballroom",
        category: "career",
        description: "Meet recruiters from local tech companies.",
        creatorUsername: "",
      },
    ];

    await Event.insertMany(sampleEvents);
    console.log(`Seeded ${sampleEvents.length} sample events.`);
  } catch (err) {
    console.error("Failed to seed sample events:", err.message);
  }
}

// =========================
// EVENTS API (+ helper to shape responses)
// =========================
// These routes drive the homepage/event feed UI (`GET`, `POST`); edit/delete endpoints appear later behind auth checks.

// Shape a Mongo event document (lean or hydrated) into the JSON the
// frontend always expects — including explicit eventImage/eventImageType
// strings — so refreshes never "lose" image fields due to serialization quirks.
function shapePublicEvent(raw) {
  const e =
    raw && typeof raw.toObject === "function"
      ? raw.toObject()
      : raw || {};
  const id =
    e._id && e._id.toString ? e._id.toString() : e.id ? String(e.id) : "";
  return {
    id,
    title: e.title ?? "",
    date: e.date ?? "",
    time: e.time ?? "",
    location: e.location ?? "",
    category: e.category ?? "",
    description: e.description ?? "",
    creatorUsername: e.creatorUsername ?? "",
    createdAt: e.createdAt ?? null,
    eventImage:
      typeof e.eventImage === "string" ? e.eventImage : "",
    eventImageType:
      typeof e.eventImageType === "string" ? e.eventImageType : "",
  };
}

// GET /api/events
// Returns every event in the database, newest first.
// "Newest" means the most recently *created* event (createdAt desc), so a
// brand-new event a user just submitted shows up at the top of the list.
//
// Each event in the response includes two extra fields so the frontend can
// render the "X going" line + small avatar preview WITHOUT a follow-up fetch:
//
//   attendeeCount : number      // total unique RSVPs for this event
//   attendees     : Array<{ username, fullName, profilePicture, profilePictureType }>
//                                // up to 3 sample attendees (preview avatars)
//
// Why both fields?
//   - `attendeeCount` is the source of truth for the "N people going" label
//     so the count shown on the card and inside the View Details modal can
//     never disagree (they read the same number).
//   - `attendees` powers the small avatar stack on each card on first paint.
//     We cap it at 3 to keep the events list payload small. The People Going
//     modal still loads the FULL guest list from /api/events/:id/attendees.
app.get("/api/events", async (req, res) => {
  try {
    // 1. Fetch the raw events first — same query as before so ordering and
    //    the response shape stay identical for every other field.
    const events = await Event.find().sort({ createdAt: -1 }).lean();
    if (events.length === 0) {
      return res.json([]);
    }

    // 2. Count RSVPs and collect each event's user ids in ONE aggregation.
    //    The `$sort` step ensures the preview ids we keep (the first 3) are
    //    the earliest RSVPs — i.e. the "earliest to say yes" — which is a
    //    stable, beginner-friendly choice.
    const eventIds = events.map((e) => e._id);
    const grouped = await RSVP.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $sort: { _id: 1 } },
      {
        $group: {
          _id: "$eventId",
          count: { $sum: 1 },
          userIds: { $push: "$userId" },
        },
      },
    ]);

    // 3. Batch-look up the preview users (max 3 per event) in ONE round-trip.
    //    Using `$in` over all preview ids at once is much faster than a loop.
    const previewIdSet = new Set();
    grouped.forEach((g) => {
      const ids = Array.isArray(g.userIds) ? g.userIds.slice(0, 3) : [];
      ids.forEach((uid) => previewIdSet.add(String(uid)));
    });

    let userById = new Map();
    if (previewIdSet.size > 0) {
      const previewUsers = await User.find({
        _id: { $in: Array.from(previewIdSet) },
      })
        .select("username name displayName profilePicture profilePictureType")
        .lean();
      userById = new Map(previewUsers.map((u) => [u._id.toString(), u]));
    }

    // Helper: shape one preview attendee in the same fields the People Going
    // modal expects, so the frontend can reuse its normalizer either way.
    function shapePreviewAttendee(u) {
      if (!u) return null;
      const username = typeof u.username === "string" ? u.username.trim() : "";
      const display =
        (u.displayName && String(u.displayName).trim()) ||
        (u.name && String(u.name).trim()) ||
        "";
      return {
        username,
        displayName: display,
        fullName: display || username,
        profilePicture:
          typeof u.profilePicture === "string" ? u.profilePicture : "",
        profilePictureType:
          u.profilePictureType === "uploaded" ? "uploaded" : "default",
      };
    }

    // 4. Build a quick lookup: eventId -> { count, attendees: previews[] }.
    const summaryByEvent = new Map();
    grouped.forEach((g) => {
      const ids = Array.isArray(g.userIds) ? g.userIds.slice(0, 3) : [];
      const previews = ids
        .map((uid) => shapePreviewAttendee(userById.get(String(uid))))
        .filter(Boolean);
      summaryByEvent.set(String(g._id), {
        count: g.count || 0,
        attendees: previews,
      });
    });

    // 5. Attach `attendeeCount` + `attendees` to every event payload.
    //    Events with zero RSVPs (no aggregation row) get { 0, [] } defaults
    //    so the frontend never has to null-check.
    const out = events.map((e) => {
      const base = shapePublicEvent(e);
      const summary = summaryByEvent.get(String(e._id)) || {
        count: 0,
        attendees: [],
      };
      base.attendeeCount = summary.count;
      base.attendees = summary.attendees;
      return base;
    });

    res.json(out);
  } catch (err) {
    console.error("GET /api/events failed:", err);
    res.status(500).json({ error: "Failed to fetch events." });
  }
});

// POST /api/events
// Creates a new event and saves it permanently to MongoDB so every user
// (and every future server restart) can still see it.
//
// Expected JSON body:
//   {
//     title:           string  (required)
//     date:            string  (required, e.g. "2026-05-15")
//     time:            string  (required, e.g. "18:00")
//     location:        string  (required)
//     description:     string  (required)
//     category:        string  (optional, e.g. "tech", "music")
//     creatorUsername: string  (optional, who created the event)
//     eventImage:      string  (optional, Base64 data URL from the browser)
//     eventImageType:  optional — client may send "uploaded"; we only store
//                      "uploaded" when eventImage is non-empty, else ""
//   }
//
// Validation: title, date, time, location, and description must all be
// non-empty strings. Anything else returns 400 with a friendly message.
app.post("/api/events", async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      location,
      category,
      description,
      creatorUsername,
      eventImage,
    } = req.body || {};

    // Helper: true only if the value is a non-empty string after trimming.
    function isFilled(value) {
      return typeof value === "string" && value.trim() !== "";
    }

    // The five fields the assignment marks as required.
    if (
      !isFilled(title) ||
      !isFilled(date) ||
      !isFilled(time) ||
      !isFilled(location) ||
      !isFilled(description)
    ) {
      return res.status(400).json({
        error:
          "Please provide title, date, time, location, and description.",
      });
    }

    // Optional flyer / cover image — stored exactly as produced by the
    // frontend (readAsDataURL). eventImageType is always "" or "uploaded"
    // based on whether bytes were actually saved (not only what the client claimed).
    const imageStr =
      typeof eventImage === "string" && eventImage.trim() !== ""
        ? eventImage.trim()
        : "";

    // Build the document. We trim every string so we don't store stray
    // whitespace, and we default the optional fields to empty strings so
    // the response shape is always predictable.
    const newEvent = await Event.create({
      title: title.trim(),
      date: date.trim(),
      time: time.trim(),
      location: location.trim(),
      category: typeof category === "string" ? category.trim() : "",
      description: description.trim(),
      creatorUsername:
        typeof creatorUsername === "string" ? creatorUsername.trim() : "",
      eventImage: imageStr,
      eventImageType: imageStr ? "uploaded" : "",
    });

    // 201 Created + the saved event (including its id and createdAt).
    res.status(201).json(shapePublicEvent(newEvent));
  } catch (err) {
    console.error("POST /api/events failed:", err);
    res.status(500).json({ error: "Could not create event." });
  }
});

// =========================
// EVENT COMMENTS API
// =========================
// Frontend: threaded discussion beneath each card — GET loads history, POST requires a logged-in user id via username/email lookup.
//
// GET  /api/events/:id/comments — list comments for one event (newest first).
// POST /api/events/:id/comments — add a comment (requires a real user).
// DELETE /api/comments/:commentId — author or admin only (403 otherwise).
const COMMENT_TEXT_MAX = Comment.COMMENT_TEXT_MAX || 2000;

async function authorizeCommentDelete(commentId, body) {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return { ok: false, status: 400, error: "Invalid comment id." };
  }

  const identifier =
    (body && (body.username || body.email)) ||
    (body && (body.requesterUsername || body.requesterEmail)) ||
    "";

  if (!identifier || typeof identifier !== "string" || identifier.trim() === "") {
    return {
      ok: false,
      status: 400,
      error: "Please provide your username (or email) in the request body.",
    };
  }

  const requester = await findUserByEmailOrUsername(identifier.trim());
  if (!requester) {
    return { ok: false, status: 401, error: "Requester not found." };
  }

  const commentDoc = await Comment.findById(commentId);
  if (!commentDoc) {
    return { ok: false, status: 404, error: "Comment not found." };
  }

  const dbRole = requester.role || "user";
  if (dbRole === "admin") {
    return { ok: true, user: requester, comment: commentDoc };
  }

  const author = (commentDoc.creatorUsername || "").trim().toLowerCase();
  const me = (requester.username || "").trim().toLowerCase();
  if (author && author === me) {
    return { ok: true, user: requester, comment: commentDoc };
  }

  return {
    ok: false,
    status: 403,
    error: "You can only delete your own comments.",
  };
}

app.get("/api/events/:id/comments", async (req, res) => {
  try {
    const eventId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id." });
    }

    const eventExists = await Event.exists({ _id: eventId });
    if (!eventExists) {
      return res.status(404).json({ error: "Event not found." });
    }

    // Newest comments first so fresh discussion appears at the top.
    const rows = await Comment.find({ eventId }).sort({ createdAt: -1 }).lean();

    res.json(
      rows.map((row) => ({
        id: row._id.toString(),
        eventId: row.eventId.toString(),
        text: row.text,
        creatorUsername: row.creatorUsername,
        creatorProfilePicture: row.creatorProfilePicture || "",
        creatorProfilePictureType: row.creatorProfilePictureType || "default",
        createdAt: row.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/events/:id/comments failed:", err.message);
    res.status(500).json({ error: "Could not load comments." });
  }
});

app.post("/api/events/:id/comments", async (req, res) => {
  try {
    const eventId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id." });
    }

    const eventDoc = await Event.findById(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found." });
    }

    const body = req.body || {};
    const identifier =
      body.username ||
      body.email ||
      body.requesterUsername ||
      body.requesterEmail ||
      "";

    if (
      !identifier ||
      typeof identifier !== "string" ||
      identifier.trim() === ""
    ) {
      return res
        .status(400)
        .json({ error: "Please provide your username (or email)." });
    }

    const textRaw = body.text;
    if (typeof textRaw !== "string" || textRaw.trim() === "") {
      return res.status(400).json({ error: "Comment cannot be empty." });
    }

    const text = textRaw.trim();
    if (text.length > COMMENT_TEXT_MAX) {
      return res.status(400).json({
        error: `Comment must be at most ${COMMENT_TEXT_MAX} characters.`,
      });
    }

    const user = await findUserByEmailOrUsername(identifier.trim());
    if (!user) {
      return res
        .status(401)
        .json({ error: "User not found. Please log in again." });
    }

    const pic = typeof user.profilePicture === "string" ? user.profilePicture : "";
    const picType =
      user.profilePictureType === "uploaded" ? "uploaded" : "default";

    const created = await Comment.create({
      eventId: eventDoc._id,
      text,
      creatorUsername: user.username,
      creatorProfilePicture: pic,
      creatorProfilePictureType: picType,
    });

    res.status(201).json(created.toJSON());
  } catch (err) {
    console.error("POST /api/events/:id/comments failed:", err.message);
    res.status(500).json({ error: "Could not post comment." });
  }
});

app.delete("/api/comments/:commentId", async (req, res) => {
  try {
    const auth = await authorizeCommentDelete(req.params.commentId, req.body || {});
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await Comment.deleteOne({ _id: auth.comment._id });
    res.json({ message: "Comment deleted." });
  } catch (err) {
    console.error("DELETE /api/comments/:commentId failed:", err.message);
    res.status(500).json({ error: "Could not delete comment." });
  }
});

// =========================
// EVENT OWNERSHIP HELPERS (+ PUT / DELETE EVENT)
// =========================
// Both PUT and DELETE on /api/events/:id share the same auth flow:
//   1. Look up the requester by username (or email) in MongoDB.
//   2. Re-read their actual role from the DB — we NEVER trust a `role`
//      value sent from the frontend, because anyone could change it in
//      DevTools. localStorage is for UI hints only.
//   3. Allow the action if the DB role is "admin", OR if the event's
//      stored creatorUsername matches the requester's username
//      (case-insensitive).
//   4. Otherwise return 403 with the exact wording the spec asks for.
//
// This helper does steps 1–3 and returns either:
//   { ok: true,  user, event }                — caller may proceed
//   { ok: false, status, error }              — caller should respond
async function authorizeEventChange(eventId, body) {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return { ok: false, status: 400, error: "Invalid event id." };
  }

  // Accept any of the field names the spec or the older code may use.
  // The spec sample shows { username, role, ... } in the body; we also
  // accept email so this works seamlessly with users who only have an
  // email saved in localStorage.
  const identifier =
    (body && (body.username || body.email)) ||
    (body && (body.requesterUsername || body.requesterEmail)) ||
    "";

  if (!identifier) {
    return {
      ok: false,
      status: 400,
      error: "Please provide your username (or email) in the request body.",
    };
  }

  const requester = await findUserByEmailOrUsername(identifier);
  if (!requester) {
    // 401 (not 403) so the client knows it's an auth problem, not an
    // ownership problem — they're not logged in as a real user.
    return { ok: false, status: 401, error: "Requester not found." };
  }

  const eventDoc = await Event.findById(eventId);
  if (!eventDoc) {
    return { ok: false, status: 404, error: "Event not found." };
  }

  // ----- Permission check ----------------------------------------------
  // Admins (per the live DB role) can edit/delete anything.
  const dbRole = requester.role || "user";
  if (dbRole === "admin") {
    return { ok: true, user: requester, event: eventDoc };
  }

  // Otherwise the requester must be the creator of this specific event.
  // Compare case-insensitively to match the rest of the app's username
  // conventions (signup stores usernameLower, friends use lowercase).
  const creator = (eventDoc.creatorUsername || "").trim().toLowerCase();
  const me = (requester.username || "").trim().toLowerCase();
  if (creator && creator === me) {
    return { ok: true, user: requester, event: eventDoc };
  }

  return {
    ok: false,
    status: 403,
    error: "You can only modify events you created.",
  };
}

// PUT /api/events/:id
// Updates an existing event. Anyone may try to call this, but the
// permission check above limits actual updates to:
//   - the event's creator (matched on creatorUsername), OR
//   - any user whose live MongoDB role is "admin".
//
// Body fields that may be updated (all optional — only provided ones change):
//   title, date, time, location, category, description, eventImage
// Including `eventImage: ""` clears the stored picture; the server sets
// eventImageType to "uploaded" when eventImage is non-empty, else "".
// Body must also include the requester identity:
//   { username | email, role }    (role is informational; backend re-verifies)
app.put("/api/events/:id", async (req, res) => {
  try {
    const auth = await authorizeEventChange(req.params.id, req.body || {});
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const { title, date, time, location, category, description, eventImage } =
      req.body || {};

    // Whitelist the editable fields. Anything else in the body is
    // ignored — we never let callers patch creatorUsername, _id, etc.
    const updates = {};
    if (typeof title === "string" && title.trim() !== "") {
      updates.title = title.trim();
    }
    if (typeof date === "string" && date.trim() !== "") {
      updates.date = date.trim();
    }
    if (typeof time === "string") {
      updates.time = time.trim();
    }
    if (typeof location === "string" && location.trim() !== "") {
      updates.location = location.trim();
    }
    if (typeof category === "string") {
      updates.category = category.trim();
    }
    if (typeof description === "string" && description.trim() !== "") {
      updates.description = description.trim();
    }
    // Image updates are sent only when the client changed the file on the
    // edit form (see script.js). Key must be present to avoid wiping the
    // picture on unrelated field edits.
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "eventImage")) {
      if (typeof eventImage === "string") {
        const trimmed = eventImage.trim();
        updates.eventImage = trimmed;
        updates.eventImageType = trimmed ? "uploaded" : "";
      }
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ error: "Please provide at least one field to update." });
    }

    Object.assign(auth.event, updates);
    const saved = await auth.event.save();

    res.json({ message: "Event updated.", event: shapePublicEvent(saved) });
  } catch (err) {
    console.error("PUT /api/events/:id failed:", err);
    res.status(500).json({ error: "Could not update event." });
  }
});

// DELETE /api/events/:id
// Removes an event from MongoDB. Permission rules match PUT above:
//   - admins (per the live DB role) may delete any event
//   - regular users may delete only events they created
// We also clean up any RSVPs that referenced this event so we don't
// leave orphaned records in the RSVP collection.
//
// Body must include the requester identity:
//   { username | email, role }    (role is informational; backend re-verifies)
app.delete("/api/events/:id", async (req, res) => {
  try {
    const auth = await authorizeEventChange(req.params.id, req.body || {});
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await Event.deleteOne({ _id: auth.event._id });
    await RSVP.deleteMany({ eventId: auth.event._id });
    await Comment.deleteMany({ eventId: auth.event._id });

    res.json({ message: "Event deleted." });
  } catch (err) {
    console.error("DELETE /api/events/:id failed:", err);
    res.status(500).json({ error: "Could not delete event." });
  }
});

// =========================
// AUTH — SIGN UP NEW USER ACCOUNTS
// =========================
// Frontend registration form POSTs `{ name, username, email, password }`; response echoes `safeUser`
// JSON (never the hash) — same shape often cached in localStorage for instant UI personalization.

// POST /api/signup
// Registers a new user. Expects JSON body: { name, username, email, password }.
// - Hashes the password with bcrypt.
// - Rejects duplicate emails (409).
// - Rejects duplicate usernames, case-insensitively (400 "Username is already taken.").
// - Trims the username before saving and stores a normalized lowercase copy
//   (handled inside the User model).
app.post("/api/signup", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "Please provide name, username, email, and password.",
      });
    }

    const trimmedUsername = String(username).trim();
    if (trimmedUsername === "") {
      return res.status(400).json({ error: "Username cannot be empty." });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = trimmedUsername.toLowerCase();

    // Reject duplicate emails (existing behavior).
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ error: "That email is already registered." });
    }

    // Reject duplicate usernames (case-insensitive thanks to usernameLower).
    const existingUsername = await User.findOne({
      usernameLower: normalizedUsername,
    });
    if (existingUsername) {
      return res.status(400).json({ error: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      username: trimmedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });

    // Note: we never include `password` in the response. New accounts
    // always start with role "user"; admins are unlocked later through
    // /api/settings/admin-key.
    res.status(201).json({
      message: "Signup successful.",
      user: safeUser(newUser),
    });
  } catch (err) {
    // Race condition fallback: rely on the unique indexes if two requests
    // race past the findOne checks above.
    if (err && err.code === 11000) {
      const dupKey = err.keyPattern || {};
      if (dupKey.usernameLower) {
        return res.status(400).json({ error: "Username is already taken." });
      }
      if (dupKey.email) {
        return res.status(409).json({ error: "That email is already registered." });
      }
      // Unknown unique-index conflict — safest beginner-friendly default.
      return res.status(400).json({ error: "Username is already taken." });
    }
    console.error("POST /api/signup failed:", err);
    res.status(500).json({ error: "Signup failed." });
  }
});

// =========================
// USER DISCOVERY + PUBLIC PROFILE PAGES (`/api/users/...`)
// =========================

// GET /api/users/search?username=...
// Case-insensitive, partial username search.
// Returns ONLY the safe public fields:
//   - profilePicture
//   - displayName
//   - username
//   - bio
// Returns an empty array if the query is missing/empty or nothing matches.
app.get("/api/users/search", async (req, res) => {
  try {
    const raw =
      typeof req.query.username === "string" ? req.query.username.trim() : "";

    // No query? Don't dump every user — return an empty array.
    if (raw === "") {
      return res.json([]);
    }

    // Escape regex metacharacters so a search like "a.b" matches the literal
    // string "a.b" and not "a" + any char + "b".
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // The "i" flag makes the match case-insensitive. Searching the
    // pre-normalized `usernameLower` field would also work and is faster
    // for very large user tables; using the regex against `usernameLower`
    // gives us both correctness and a nicer indexed lookup.
    const pattern = new RegExp(escaped, "i");

    // .select() with `-_id` keeps the response to exactly the four fields
    // the spec asks for. .lean() returns plain JS objects (faster, and
    // skips the toJSON transform we don't need here).
    const matches = await User.find({ usernameLower: pattern })
      .select(
        "username displayName profilePicture profilePictureType bio school location hobbies -_id"
      )
      .limit(20)
      .lean();

    res.json(matches.map(publicProfile));
  } catch (err) {
    console.error("GET /api/users/search failed:", err);
    res.status(500).json({ error: "User search failed." });
  }
});

// GET /api/users/profile/:username
// Public member snapshot for public-profile.html (?username=)
// Explicit `/profile/` segment keeps routing deterministic (avoid proxies mistaking `/api/users/<name>` for a static asset).
// Username match is case-insensitive (normalizeUsername + usernameLower).
// Returns ONLY safe JSON fields (+ eventsCreated summaries so the page can list "Events they created"):
//   displayName, username, profilePicture, bio, school, location, interests, eventsCreated
app.get("/api/users/profile/:username", async (req, res) => {
  try {
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const user = await findUserByUsername(lower);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const u = user && typeof user.toObject === "function" ? user.toObject() : user;
    const privacy = normalizeUserPrivacy(user);

    const uname = typeof u.username === "string" ? u.username : "";

    // When the member turns off "public profile", we still return 200 JSON so the
    // SPA-style frontend can show a friendly message without treating it like "not found".
    if (!privacy.publicProfile) {
      return res.json({
        username: uname,
        privacy,
        profileIsPrivate: true,
      });
    }

    const displayName =
      u.displayName && String(u.displayName).trim() !== ""
        ? String(u.displayName).trim()
        : u.name && String(u.name).trim() !== ""
          ? String(u.name).trim()
          : "";
    const interests = Array.isArray(u.hobbies) ? u.hobbies : [];

    const esc = uname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const createdEvents = await Event.find({
      creatorUsername: new RegExp("^" + esc + "$", "i"),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      displayName,
      username: uname,
      profilePicture:
        typeof u.profilePicture === "string" ? u.profilePicture : "",
      bio: typeof u.bio === "string" ? u.bio : "",
      school: typeof u.school === "string" ? u.school : "",
      location: typeof u.location === "string" ? u.location : "",
      interests,
      eventsCreated: createdEvents.map(shapePublicEvent),
      privacy,
      profileIsPrivate: false,
    });
  } catch (err) {
    console.error("GET /api/users/profile/:username failed:", err);
    res.status(500).json({ error: "Could not load user profile." });
  }
});

// GET /api/users/:username
// Public profile for any user (no email / role / password).
// Also returns events they created (creatorUsername match, case-insensitive).
//
// Registered immediately after /api/users/search so "search" is not captured
// as a :username.
app.get("/api/users/:username", async (req, res) => {
  try {
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const user = await findUserByUsername(lower);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const uname = typeof user.username === "string" ? user.username : "";
    const esc = uname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const createdEvents = await Event.find({
      creatorUsername: new RegExp("^" + esc + "$", "i"),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      user: publicProfile(user),
      eventsCreated: createdEvents.map(shapePublicEvent),
    });
  } catch (err) {
    console.error("GET /api/users/:username failed:", err);
    res.status(500).json({ error: "Could not load user profile." });
  }
});

// =========================
// PROFILE API (`/api/profile/...`)
// =========================
// These routes let the frontend fetch and update a user's public profile
// data — most importantly their profile picture, which is stored
// permanently in MongoDB so it survives logouts and device switches.
//
// Username matching is case-insensitive: the URL parameter is lowercased
// and compared against the indexed `usernameLower` field on the User
// document.
//
// IMPORTANT: every response on this section uses `safeUser(...)` so the
// password (and password hash) is NEVER sent back to the client.

// GET /api/profile/:username
// Returns the safe user object (no password) for the given username.
// Useful for the Profile page to load the latest profile picture and
// other public-ish info from the database instead of stale localStorage.
app.get("/api/profile/:username", async (req, res) => {
  try {
    // Normalize the URL parameter: trim + lowercase so "Alice" and
    // "alice" both resolve to the same account.
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const user = await findUserByUsername(lower);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // safeUser() strips the password and includes the profile picture
    // fields the frontend needs.
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("GET /api/profile/:username failed:", err);
    res.status(500).json({ error: "Could not load profile." });
  }
});

// PUT /api/profile/:username/picture
// Body: { profilePicture: string, profilePictureType: "default" | "uploaded" }
//
// Saves the picture to MongoDB so it persists across sessions:
//   - If `profilePictureType` is "default", `profilePicture` should be
//     the id/name of a built-in avatar (e.g. "heart").
//   - If `profilePictureType` is "uploaded", `profilePicture` should be
//     a Base64 image string the user picked from their device (typically
//     a data URL like "data:image/png;base64,...").
//
// On success, returns the updated safe user object (no password).
app.put("/api/profile/:username/picture", async (req, res) => {
  try {
    // 1. Find the user. Same case-insensitive lookup as GET above.
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const user = await findUserByUsername(lower);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // 2. Validate the request body.
    const { profilePicture, profilePictureType } = req.body || {};

    // `profilePictureType` must be exactly one of the two allowed values.
    if (
      profilePictureType !== "default" &&
      profilePictureType !== "uploaded"
    ) {
      return res.status(400).json({
        error: 'profilePictureType must be "default" or "uploaded".',
      });
    }

    // `profilePicture` must be a non-empty string. We don't try to
    // strictly validate the Base64 format here to keep things
    // beginner-friendly — the frontend is responsible for producing a
    // valid value (e.g. via FileReader.readAsDataURL).
    if (typeof profilePicture !== "string" || profilePicture.trim() === "") {
      return res.status(400).json({
        error: "profilePicture must be a non-empty string.",
      });
    }

    // 3. Save to MongoDB.
    user.profilePicture = profilePicture;
    user.profilePictureType = profilePictureType;
    await user.save();

    // 4. Respond with the updated safe user (password is never included).
    res.json({
      message: "Profile picture updated.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("PUT /api/profile/:username/picture failed:", err);
    res.status(500).json({ error: "Could not update profile picture." });
  }
});

// PUT /api/profile/:username/details
// Body: { name?, displayName?, bio?, school?, location?, hobbies? }
// Persists text profile fields so they appear on public profiles.
// Same case-insensitive username matching as GET/PUT picture.
const MAX_PROFILE_HOBBIES = 32;
const MAX_BIO_LEN = 2000;

app.put("/api/profile/:username/details", async (req, res) => {
  try {
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const user = await findUserByUsername(lower);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const body = req.body || {};

    if (typeof body.name === "string") {
      const n = body.name.trim();
      if (n === "") {
        return res.status(400).json({ error: "Name cannot be empty." });
      }
      user.name = n;
    }

    if (typeof body.displayName === "string") {
      user.displayName = body.displayName.trim().slice(0, 120);
    }

    if (typeof body.bio === "string") {
      user.bio = body.bio.trim().slice(0, MAX_BIO_LEN);
    }

    if (typeof body.school === "string") {
      user.school = body.school.trim().slice(0, 120);
    }

    if (typeof body.location === "string") {
      user.location = body.location.trim().slice(0, 120);
    }

    if (body.hobbies !== undefined) {
      if (!Array.isArray(body.hobbies)) {
        return res.status(400).json({ error: "hobbies must be an array of strings." });
      }
      const cleaned = body.hobbies
        .map((h) => (typeof h === "string" ? h.trim() : ""))
        .filter((h) => h !== "")
        .slice(0, MAX_PROFILE_HOBBIES);
      user.hobbies = cleaned;
    }

    await user.save();

    res.json({
      message: "Profile updated.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("PUT /api/profile/:username/details failed:", err);
    res.status(500).json({ error: "Could not update profile." });
  }
});

// =========================
// SHARED USERNAME HELPERS (friends, messages, search, profiles)
// =========================
// All friend routes work with usernames. To keep checks case-insensitive
// (so "Alice" == "alice"), we always trim and lowercase before doing any
// comparison or storing anything in the database.

// Returns a normalized lowercase username, or null if the input is missing
// or only whitespace.
function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.toLowerCase();
}

// Looks up a User document by their lowercased username. Returns null if
// no such user exists.
async function findUserByUsername(lowerUsername) {
  return User.findOne({ usernameLower: lowerUsername });
}

// Normalizes the nested `privacy` object on a User for JSON APIs.
// Missing fields behave as "true" (same as Mongoose defaults) so older DB rows stay public.
function normalizeUserPrivacy(user) {
  const u =
    user && typeof user.toObject === "function" ? user.toObject() : user || {};
  const p = u.privacy || {};
  return {
    publicProfile: p.publicProfile !== false,
    showHobbies: p.showHobbies !== false,
    showAttendedEvents: p.showAttendedEvents !== false,
    allowMessages: p.allowMessages !== false,
  };
}

// Builds the safe public profile payload we return for friend-related routes,
// user search, and GET /api/users/:username. Never includes passwords or email.
function publicProfile(user) {
  const u = user && typeof user.toObject === "function" ? user.toObject() : user || {};
  const hobbies = Array.isArray(u.hobbies) ? u.hobbies : [];
  const displayName = u.displayName || "";
  const name = u.name || "";
  return {
    username: u.username,
    name,
    displayName,
    fullName: displayName || name,
    profilePicture: u.profilePicture || "",
    profilePictureType: u.profilePictureType || "default",
    bio: u.bio || "",
    school: u.school || "",
    location: u.location || "",
    hobbies,
    interests: hobbies,
    privacy: normalizeUserPrivacy(user),
  };
}

// =========================
// FRIENDS SYSTEM (requests + list + unfriend)
// =========================

// POST /api/friends/request
// Body: { senderUsername, receiverUsername }
// Sends a friend request from sender → receiver. Validates that:
//   - both usernames are provided,
//   - sender is not the same person as receiver,
//   - both users exist,
//   - the two are not already friends,
//   - there isn't already a pending request from sender → receiver.
app.post("/api/friends/request", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    if (sender === receiver) {
      return res
        .status(400)
        .json({ error: "You cannot send a friend request to yourself." });
    }

    // Confirm both users exist before doing anything else.
    const senderUser = await findUserByUsername(sender);
    if (!senderUser) {
      return res.status(404).json({ error: "Sender user not found." });
    }
    const receiverUser = await findUserByUsername(receiver);
    if (!receiverUser) {
      return res.status(404).json({ error: "Receiver user not found." });
    }

    // Already friends? (Either side's array is enough — we keep them in
    // sync inside the accept route.)
    const alreadyFriends =
      Array.isArray(senderUser.friends) &&
      senderUser.friends.includes(receiver);
    if (alreadyFriends) {
      return res
        .status(400)
        .json({ error: "You are already friends with this user." });
    }

    // No duplicate pending request from the same sender → receiver pair.
    const existingPending = await FriendRequest.findOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({
        error: "A pending friend request to this user already exists.",
      });
    }

    const created = await FriendRequest.create({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });

    res.status(201).json({
      message: "Friend request sent.",
      request: {
        id: created.id,
        senderUsername: created.senderUsername,
        receiverUsername: created.receiverUsername,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/friends/request failed:", err);
    res.status(500).json({ error: "Could not send friend request." });
  }
});

// GET /api/friends/requests/:username
// Returns this user's *pending incoming* friend requests, newest first.
// Each entry is enriched with the sender's safe public profile fields so
// the frontend can render a card without making a second request.
app.get("/api/friends/requests/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const requests = await FriendRequest.find({
      receiverUsername: username,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (requests.length === 0) {
      return res.json([]);
    }

    // One round-trip lookup of every sender's public profile.
    const senderUsernames = requests.map((r) => r.senderUsername);
    const senders = await User.find({
      usernameLower: { $in: senderUsernames },
    })
      .select(
        "username name displayName profilePicture profilePictureType bio school location hobbies usernameLower -_id"
      )
      .lean();

    // Build a lookup map: lowercased username → safe public profile.
    const senderMap = new Map();
    senders.forEach((s) => {
      senderMap.set(s.usernameLower, publicProfile(s));
    });

    const enriched = requests.map((r) => ({
      id: r._id.toString(),
      senderUsername: r.senderUsername,
      status: r.status,
      createdAt: r.createdAt,
      // Public sender info if the user still exists; safe defaults otherwise.
      sender: senderMap.get(r.senderUsername) || {
        username: r.senderUsername,
        name: "",
        displayName: "",
        profilePicture: "",
        profilePictureType: "default",
        bio: "",
        school: "",
        location: "",
        hobbies: [],
      },
    }));

    res.json(enriched);
  } catch (err) {
    console.error("GET /api/friends/requests/:username failed:", err);
    res.status(500).json({ error: "Could not load friend requests." });
  }
});

// POST /api/friends/accept
// Body: { senderUsername, receiverUsername }
// Marks the matching pending request as "accepted" and adds each user to
// the other's friends array. Uses $addToSet so the same friend can never
// be added twice.
app.post("/api/friends/accept", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const request = await FriendRequest.findOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });
    if (!request) {
      return res
        .status(404)
        .json({ error: "No pending friend request found for those users." });
    }

    request.status = "accepted";
    await request.save();

    // Make sure both users have each other in their friends list.
    await Promise.all([
      User.updateOne(
        { usernameLower: sender },
        { $addToSet: { friends: receiver } }
      ),
      User.updateOne(
        { usernameLower: receiver },
        { $addToSet: { friends: sender } }
      ),
    ]);

    res.json({
      message: "Friend request accepted.",
      request: {
        id: request.id,
        senderUsername: request.senderUsername,
        receiverUsername: request.receiverUsername,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/friends/accept failed:", err);
    res.status(500).json({ error: "Could not accept friend request." });
  }
});

// POST /api/friends/deny
// Body: { senderUsername, receiverUsername }
// Marks the matching pending request as "denied". Does NOT touch the
// friends arrays — the two users do not become friends.
app.post("/api/friends/deny", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const request = await FriendRequest.findOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });
    if (!request) {
      return res
        .status(404)
        .json({ error: "No pending friend request found for those users." });
    }

    request.status = "denied";
    await request.save();

    res.json({
      message: "Friend request denied.",
      request: {
        id: request.id,
        senderUsername: request.senderUsername,
        receiverUsername: request.receiverUsername,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/friends/deny failed:", err);
    res.status(500).json({ error: "Could not deny friend request." });
  }
});

// DELETE /api/friend-requests/cancel
// Body: { senderUsername, receiverUsername }
// Deletes the pending FriendRequest from sender → receiver. 200 if a row
// was removed, 404 if no matching pending request exists.
app.delete("/api/friend-requests/cancel", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const result = await FriendRequest.deleteOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: "No pending friend request found for those users.",
      });
    }

    res.status(200).json({ message: "Friend request canceled." });
  } catch (err) {
    console.error("DELETE /api/friend-requests/cancel failed:", err);
    res.status(500).json({ error: "Could not cancel friend request." });
  }
});

// GET /api/friends/:username
// Returns the user's accepted friends as an array of public profile objects
// (safe to render on the frontend without further fetching). Returns [] if
// the user has no friends yet, and 404 if the user does not exist.
app.get("/api/friends/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const friendUsernames = Array.isArray(user.friends) ? user.friends : [];
    if (friendUsernames.length === 0) {
      return res.json([]);
    }

    const friends = await User.find({
      usernameLower: { $in: friendUsernames },
    })
      .select(
        "username name displayName profilePicture profilePictureType bio school location hobbies -_id"
      )
      .lean();

    // Map to the safe public shape (in case any extra fields slipped in).
    res.json(friends.map((f) => publicProfile(f)));
  } catch (err) {
    console.error("GET /api/friends/:username failed:", err);
    res.status(500).json({ error: "Could not load friends." });
  }
});

// DELETE /api/friends/remove
// Body: { usernameA, usernameB }
// Removes the friendship in both users' friends arrays (if linked) and
// deletes any FriendRequest documents between the pair in either direction.
// 200 on success, 404 if the users are not linked as friends (or a user is
// missing).
app.delete("/api/friends/remove", async (req, res) => {
  try {
    const a = normalizeUsername(req.body.usernameA);
    const b = normalizeUsername(req.body.usernameB);

    if (!a || !b) {
      return res.status(400).json({
        error: "Please provide usernameA and usernameB.",
      });
    }

    if (a === b) {
      return res.status(400).json({
        error: "usernameA and usernameB must be different users.",
      });
    }

    const userA = await findUserByUsername(a);
    const userB = await findUserByUsername(b);

    if (!userA || !userB) {
      return res.status(404).json({ error: "Users are not friends." });
    }

    const friendsA = Array.isArray(userA.friends) ? userA.friends : [];
    const friendsB = Array.isArray(userB.friends) ? userB.friends : [];
    const linked = friendsA.includes(b) || friendsB.includes(a);

    if (!linked) {
      return res.status(404).json({ error: "Users are not friends." });
    }

    await Promise.all([
      User.updateOne({ usernameLower: a }, { $pull: { friends: b } }),
      User.updateOne({ usernameLower: b }, { $pull: { friends: a } }),
    ]);

    await FriendRequest.deleteMany({
      $or: [
        { senderUsername: a, receiverUsername: b },
        { senderUsername: b, receiverUsername: a },
      ],
    });

    res.status(200).json({ message: "Friendship removed." });
  } catch (err) {
    console.error("DELETE /api/friends/remove failed:", err);
    res.status(500).json({ error: "Could not remove friendship." });
  }
});

// =========================
// LOGIN (SESSION DATA FOR FRONTEND + DB READ)
// =========================
//
// Stateless API: issuing no server cookie/JWT means the SPA keeps whichever user blob it prefers.
// Subsequent “who am I?” calls still pass username/email in bodies so routes can Mongo-lookup securely.
//

// POST /api/login
// Logs a user in. Expects JSON body: { email, password }.
// Compares the provided password against the stored bcrypt hash.
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Include `role` so the frontend knows whether to show admin
    // controls right after login (without an extra round-trip).
    res.json({
      message: "Login successful.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/login failed:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// =========================
// RSVP API (model: backend/models/RSVP.js)
// =========================
// Links Mongo User `_id` ↔ Event `_id`. Frontend sends both strings after signup stores `user.id`.

// POST /api/rsvp
// Records an RSVP. Expects JSON body: { userId, eventId } as ObjectId strings.
// Validates that the user and event both exist, and prevents duplicate RSVPs.
app.post("/api/rsvp", async (req, res) => {
  try {
    const { userId, eventId } = req.body;

    if (!userId || !eventId) {
      return res.status(400).json({ error: "Please provide userId and eventId." });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(eventId)
    ) {
      return res.status(400).json({ error: "Invalid userId or eventId." });
    }

    const userExists = await User.exists({ _id: userId });
    if (!userExists) return res.status(404).json({ error: "User not found." });

    const eventExists = await Event.exists({ _id: eventId });
    if (!eventExists) return res.status(404).json({ error: "Event not found." });

    const alreadyRsvped = await RSVP.findOne({ userId, eventId });
    if (alreadyRsvped) {
      return res
        .status(200)
        .json({ message: "You have already RSVP'd to this event." });
    }

    const newRsvp = await RSVP.create({ userId, eventId });

    res.status(201).json({
      message: "RSVP saved.",
      rsvp: {
        id: newRsvp.id,
        userId: newRsvp.userId.toString(),
        eventId: newRsvp.eventId.toString(),
      },
    });
  } catch (err) {
    // Race condition fallback: rely on the unique compound index.
    if (err && err.code === 11000) {
      return res
        .status(200)
        .json({ message: "You have already RSVP'd to this event." });
    }
    console.error("POST /api/rsvp failed:", err);
    res.status(500).json({ error: "RSVP failed." });
  }
});

// DELETE /api/rsvp
// Cancels an existing RSVP. Body: { userId, eventId } — same shape as
// POST /api/rsvp so the frontend only has to swap the HTTP method.
//
// This route is intentionally idempotent: if there's no matching RSVP
// to delete, we still respond with 200 success. That way the UI ends up
// in the "not RSVP'd" state regardless, and a user double-clicking the
// Cancel button can never get stuck on a confusing error.
app.delete("/api/rsvp", async (req, res) => {
  try {
    const { userId, eventId } = req.body || {};

    if (!userId || !eventId) {
      return res
        .status(400)
        .json({ error: "Please provide userId and eventId." });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(eventId)
    ) {
      return res.status(400).json({ error: "Invalid userId or eventId." });
    }

    // deleteOne returns { acknowledged, deletedCount }. We treat 0 and 1
    // both as success — see the comment above about idempotence.
    const result = await RSVP.deleteOne({ userId, eventId });

    if (result.deletedCount === 0) {
      return res
        .status(200)
        .json({ message: "No RSVP to cancel — already removed." });
    }

    res.json({ message: "RSVP canceled." });
  } catch (err) {
    console.error("DELETE /api/rsvp failed:", err);
    res.status(500).json({ error: "Could not cancel RSVP." });
  }
});

// GET /api/rsvps/event/:eventId
// Returns RSVP count plus every attendee for that event — used by event cards,
// View Details modal, and the "People Going" roster modal.
//
// Privacy: response items include only username, displayName, and profilePicture
// (computed display name merges displayName/name). No passwords, emails, roles, etc.
//
// Route ordering note: this must stay BEFORE /api/rsvps/:username so "event"
// is not swallowed as a username.
app.get("/api/rsvps/event/:eventId", async (req, res) => {
  try {
    const eventId = req.params.eventId;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id." });
    }

    const rsvps = await RSVP.find({ eventId }).sort({ _id: 1 }).lean();
    const count = rsvps.length;

    if (rsvps.length === 0) {
      return res.json({ count: 0, attendees: [] });
    }

    const userIds = rsvps.map((r) => r.userId);
    // NOTE: we MUST keep `_id` in the result here — we key the map below by
    // `u._id.toString()`. A previous version selected "... -_id" which made
    // `u._id` undefined and crashed every call to this route (the symptom on
    // the cards was the "0 going" label never updating).
    const users = await User.find({ _id: { $in: userIds } })
      .select("username name displayName profilePicture profilePictureType")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const attendees = rsvps.map((r) => {
      const u = userMap.get(r.userId.toString());
      const displayName =
        u && (u.displayName || u.name)
          ? String(u.displayName || u.name).trim()
          : "";
      const username = u && u.username ? String(u.username).trim() : "";
      const profilePicture =
        u && typeof u.profilePicture === "string" ? u.profilePicture.trim() : "";
      return {
        username,
        displayName,
        profilePicture,
      };
    });

    res.json({ count, attendees });
  } catch (err) {
    console.error("GET /api/rsvps/event/:eventId failed:", err);
    res.status(500).json({ error: "Could not load event attendees." });
  }
});

// GET /api/events/:eventId/attendees
// Returns every RSVP user for one event as the "People Going" modal payload:
//   { attendees: [{ username, fullName, profilePicture, profilePictureType }] }
//
// Why a separate route from /api/rsvps/event/:eventId?
//   - The legacy route returns { count, attendees:[{username,displayName,profilePicture}] }
//     and is consumed by the event card avatar strip + View Details modal. We do not
//     want to change its shape and risk breaking those views.
//   - The People Going modal asks for a slightly different shape (fullName +
//     profilePictureType), and the spec also wants a different error contract
//     ({ message: "Event not found" } on 404). Keeping these concerns separated
//     means RSVP, comments, friends, profiles, admin, and event filtering all keep
//     working exactly as before.
//
// Errors:
//   - 404 { message: "Event not found" } when the id is invalid or no event matches
//   - 500 { message: "Could not load attendees." } on unexpected DB errors
app.get("/api/events/:eventId/attendees", async (req, res) => {
  try {
    const eventId = req.params.eventId;
    console.log("Loading attendees for event:", eventId);

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const eventDoc = await Event.findById(eventId);
    if (!eventDoc) {
      return res.status(404).json({ message: "Event not found" });
    }

    const rsvps = await RSVP.find({ eventId: eventDoc._id }).sort({ _id: 1 }).lean();
    if (rsvps.length === 0) {
      return res.json({ attendees: [] });
    }

    const userIds = rsvps.map((r) => r.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("username name displayName profilePicture profilePictureType")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const attendees = rsvps
      .map((r) => {
        const u = userMap.get(r.userId.toString());
        if (!u) return null;
        const username = typeof u.username === "string" ? u.username.trim() : "";
        const display =
          (u.displayName && String(u.displayName).trim()) ||
          (u.name && String(u.name).trim()) ||
          "";
        const fullName = display || username;
        const picture =
          typeof u.profilePicture === "string" ? u.profilePicture : "";
        const pictureType =
          u.profilePictureType === "uploaded" ? "uploaded" : "default";
        return {
          username,
          fullName,
          profilePicture: picture,
          profilePictureType: pictureType,
        };
      })
      .filter(Boolean);

    res.json({ attendees });
  } catch (err) {
    console.error("GET /api/events/:eventId/attendees failed:", err);
    res.status(500).json({ message: "Could not load attendees." });
  }
});

// GET /api/rsvps/:username
// Returns the full Event details for every event the given user has
// RSVP'd to. Useful for "events I'm going to" lists on the profile or
// events page.
//
// How it works (two simple queries, easy to read):
//   1. Look up the user by username (case-insensitive, via the same
//      helpers used by the friend routes). 404 if no such user.
//   2. Find every RSVP record where userId matches this user.
//   3. Fetch the matching Event documents in one batched query and
//      return them sorted by date (earliest first).
//
// Privacy: this route only returns *event* data (title, date, time,
// location, category, description, creator username, createdAt). It
// never exposes the user's password, email, hashed password, or any
// other private field on the User document.
app.get("/api/rsvps/:username", async (req, res) => {
  try {
    // Normalize the URL parameter so "Alice" and "alice" both work.
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    // Make sure the user actually exists. We need their ObjectId to
    // search the RSVP collection (RSVPs link a userId → eventId).
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Privacy: hide someone else's RSVP list unless they opted in.
    // Pass ?viewerUsername=<same username> when the logged-in user is fetching their own list.
    const viewerRaw =
      typeof req.query.viewerUsername === "string"
        ? req.query.viewerUsername.trim()
        : "";
    const viewerLower = viewerRaw ? normalizeUsername(viewerRaw) : null;
    const targetPrivacy = normalizeUserPrivacy(user);
    const viewingOwnList =
      viewerLower && viewerLower === user.usernameLower;
    if (!viewingOwnList && !targetPrivacy.showAttendedEvents) {
      return res.json([]);
    }

    // Step 1: every RSVP this user has made.
    const rsvps = await RSVP.find({ userId: user._id }).lean();
    if (rsvps.length === 0) {
      // No RSVPs yet — return an empty array (NOT a 404). The frontend
      // can render an "you haven't RSVP'd to anything yet" empty state.
      return res.json([]);
    }

    // Step 2: pull the matching events in one batched query. Using $in
    // is much faster than a loop of individual lookups.
    const eventIds = rsvps.map((rsvp) => rsvp.eventId);
    const events = await Event.find({ _id: { $in: eventIds } })
      .sort({ date: 1 })
      .lean();

    // .lean() skips the Event model's toJSON transform, so we shape the
    // public event payload explicitly here. This also doubles as a
    // whitelist — reuse the same shape as GET /api/events.
    const safeEvents = events.map(shapePublicEvent);

    res.json(safeEvents);
  } catch (err) {
    console.error("GET /api/rsvps/:username failed:", err);
    res.status(500).json({ error: "Could not load RSVP'd events." });
  }
});

// =========================
// SETTINGS & ACCOUNT ADMIN API
// =========================
// These routes are called from the Settings page on the frontend. They
// always work against the live MongoDB user (not localStorage), and they
// always use bcrypt to verify any password the user types in.

// Builds the safe user object we send back to the frontend after auth or
// settings actions. Includes `role` so the frontend knows whether to show
// admin-only controls. NEVER includes the password (or its hash).
function safeUser(user) {
  const hobbies = Array.isArray(user.hobbies) ? user.hobbies : [];
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role || "user",
    displayName: user.displayName || "",
    bio: user.bio || "",
    school: user.school || "",
    location: user.location || "",
    hobbies,
    profilePicture: user.profilePicture || "",
    profilePictureType: user.profilePictureType || "default",
    privacy: normalizeUserPrivacy(user),
  };
}

// GET /api/settings/privacy/:username
// Returns Mongo-backed privacy flags for the logged-in account only.
// Query: requesterUsername OR email — must match the user named in the URL.
app.get("/api/settings/privacy/:username", async (req, res) => {
  try {
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const identifier =
      (typeof req.query.requesterUsername === "string" &&
        req.query.requesterUsername.trim()) ||
      (typeof req.query.email === "string" && req.query.email.trim()) ||
      "";

    if (!identifier) {
      return res.status(400).json({
        error:
          "Please provide requesterUsername or email as a query parameter.",
      });
    }

    const requester = await findUserByEmailOrUsername(identifier);
    const target = await findUserByUsername(lower);
    if (!target || !requester || requester.usernameLower !== target.usernameLower) {
      return res
        .status(403)
        .json({ error: "You can only view your own privacy settings." });
    }

    res.json({
      privacy: normalizeUserPrivacy(target),
    });
  } catch (err) {
    console.error("GET /api/settings/privacy/:username failed:", err);
    res.status(500).json({ error: "Could not load privacy settings." });
  }
});

// PUT /api/settings/privacy/:username
// Body: { username | email (who is saving), privacy: { ...partial booleans } }
app.put("/api/settings/privacy/:username", async (req, res) => {
  try {
    const lower = normalizeUsername(req.params.username);
    if (!lower) {
      return res.status(400).json({ error: "Username is required." });
    }

    const body = req.body || {};
    const identifier = body.username || body.email || "";
    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({
        error: "Please provide username or email in the request body.",
      });
    }

    const requester = await findUserByEmailOrUsername(identifier);
    const user = await findUserByUsername(lower);
    if (!user || !requester || requester.usernameLower !== user.usernameLower) {
      return res
        .status(403)
        .json({ error: "You can only update your own privacy settings." });
    }

    const incoming = body.privacy || {};
    if (!user.privacy) user.privacy = {};

    if (typeof incoming.publicProfile === "boolean") {
      user.privacy.publicProfile = incoming.publicProfile;
    }
    if (typeof incoming.showHobbies === "boolean") {
      user.privacy.showHobbies = incoming.showHobbies;
    }
    if (typeof incoming.showAttendedEvents === "boolean") {
      user.privacy.showAttendedEvents = incoming.showAttendedEvents;
    }
    if (typeof incoming.allowMessages === "boolean") {
      user.privacy.allowMessages = incoming.allowMessages;
    }

    await user.save();

    res.json({
      message: "Privacy settings saved.",
      privacy: normalizeUserPrivacy(user),
    });
  } catch (err) {
    console.error("PUT /api/settings/privacy/:username failed:", err);
    res.status(500).json({ error: "Could not save privacy settings." });
  }
});

// Helper used by the settings routes below: looks up a user by email OR
// username. Returns the User document (with password hash) or null.
async function findUserByEmailOrUsername(emailOrUsername) {
  if (typeof emailOrUsername !== "string") return null;
  const trimmed = emailOrUsername.trim();
  if (trimmed === "") return null;
  const lower = trimmed.toLowerCase();
  // Try email first (matches signup behavior of storing lowercase email),
  // then fall back to a case-insensitive username lookup.
  const byEmail = await User.findOne({ email: lower });
  if (byEmail) return byEmail;
  return User.findOne({ usernameLower: lower });
}

// POST /api/settings/change-password
// Body: { email | username, currentPassword, newPassword, confirmPassword }
// - Looks up the logged-in user by email OR username.
// - Verifies currentPassword against the stored bcrypt hash.
// - Validates newPassword length (>= 8) and that confirmPassword matches.
// - Hashes the new password with bcrypt and saves it.
// - Never returns the password (or its hash) in the response.
app.post("/api/settings/change-password", async (req, res) => {
  try {
    const {
      email,
      username,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};

    const identifier = email || username;
    if (!identifier || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error:
          "Please provide email (or username), currentPassword, newPassword, and confirmPassword.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ error: "New password and confirmation do not match." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters long." });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      // Use the same generic error wording as login so we don't leak which
      // accounts exist.
      return res
        .status(401)
        .json({ error: "Current password is incorrect." });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res
        .status(401)
        .json({ error: "Current password is incorrect." });
    }

    // Same cost factor as signup so all hashes look consistent.
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      message: "Password updated successfully.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/settings/change-password failed:", err);
    res.status(500).json({ error: "Could not update password." });
  }
});

// =========================
// ADMIN UNLOCK (SECRET KEY IN .ENV ONLY)
// =========================
// The admin key itself lives in backend/.env as ADMIN_KEY. The frontend
// only ever sends the key the user typed — it never knows the real value.
// We compare the typed key to process.env.ADMIN_KEY here, on the server,
// and ONLY then promote the user's role to "admin" in MongoDB.

// POST /api/settings/admin-key
// Body: { email | username, adminKey }
// - Looks up the logged-in user.
// - Compares adminKey against process.env.ADMIN_KEY.
// - If it matches, sets user.role = "admin" and returns the safe user.
// - Otherwise returns 403 "Invalid admin key."
app.post("/api/settings/admin-key", async (req, res) => {
  try {
    const { email, username, adminKey } = req.body || {};

    const identifier = email || username;
    if (!identifier || typeof adminKey !== "string" || adminKey === "") {
      return res.status(400).json({
        error: "Please provide email (or username) and adminKey.",
      });
    }

    const expectedKey = process.env.ADMIN_KEY;
    if (!expectedKey) {
      // Fail loudly in the server log but stay vague for the client so we
      // don't leak the fact that the env file is misconfigured.
      console.error(
        "ADMIN_KEY is not set in backend/.env — admin unlock disabled."
      );
      return res.status(500).json({
        error: "Admin key feature is not configured on the server.",
      });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      // Use a generic 401 so we don't reveal whether the account exists.
      return res.status(401).json({ error: "User not found." });
    }

    // Strict equality — the typed key has to match the env value exactly.
    if (adminKey !== expectedKey) {
      return res.status(403).json({ error: "Invalid admin key." });
    }

    user.role = "admin";
    await user.save();

    res.json({
      message: "Admin mode unlocked.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/settings/admin-key failed:", err);
    res.status(500).json({ error: "Could not unlock admin mode." });
  }
});

// POST /api/settings/exit-admin
// Body: { email | username }
// - Looks up the user and sets user.role = "user".
// - Returns the updated safe user.
// - This does NOT log the user out — it only removes admin privileges.
app.post("/api/settings/exit-admin", async (req, res) => {
  try {
    const { email, username } = req.body || {};

    const identifier = email || username;
    if (!identifier) {
      return res.status(400).json({
        error: "Please provide email (or username).",
      });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.role = "user";
    await user.save();

    res.json({
      message: "Admin mode turned off.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/settings/exit-admin failed:", err);
    res.status(500).json({ error: "Could not exit admin mode." });
  }
});

// DELETE /api/settings/delete-account
// Body: { email | username, password }
// - Looks up the user and verifies their password with bcrypt.
// - Removes the user from MongoDB along with their related data:
//     * incoming + outgoing friend requests
//     * direct messages they sent or received
//     * RSVPs they made
//     * their username from every other user's `friends` array
//     * events they created get their creatorUsername blanked out so the
//       event itself is not lost (other users may have RSVP'd to it).
// - Never returns the password or the password hash in the response.
app.delete("/api/settings/delete-account", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};

    const identifier = email || username;
    if (!identifier || !password) {
      return res.status(400).json({
        error: "Please provide email (or username) and password.",
      });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Password is incorrect." });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res
        .status(401)
        .json({ error: "Password is incorrect." });
    }

    const lowerUsername = user.usernameLower;
    const userId = user._id;

    // Cascade cleanup. Each step is independent, so we run them in
    // parallel for speed.
    await Promise.all([
      // Friend requests where this user was sender OR receiver.
      FriendRequest.deleteMany({
        $or: [
          { senderUsername: lowerUsername },
          { receiverUsername: lowerUsername },
        ],
      }),
      // Direct messages they sent or received.
      Message.deleteMany({
        $or: [
          { senderUsername: lowerUsername },
          { receiverUsername: lowerUsername },
        ],
      }),
      // RSVPs they made.
      RSVP.deleteMany({ userId: userId }),
      // Pull this user from every other user's `friends` array.
      User.updateMany(
        { friends: lowerUsername },
        { $pull: { friends: lowerUsername } }
      ),
      // Events they created: keep them (other users may have RSVP'd) but
      // mark the creator as removed so we don't keep showing a name that
      // no longer exists.
      Event.updateMany(
        { creatorUsername: user.username },
        { $set: { creatorUsername: "[deleted user]" } }
      ),
    ]);

    // Finally remove the user document itself.
    await User.deleteOne({ _id: userId });

    res.json({
      message: "Account deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE /api/settings/delete-account failed:", err);
    res.status(500).json({ error: "Could not delete account." });
  }
});

// =========================
// DIRECT MESSAGES (Mongo + Socket fallback)
// =========================

// POST /api/messages
// Sends a direct message from one user to another.
// Body: { senderUsername, receiverUsername, text }
//
// Validation:
//   - All three fields must be non-empty strings.
//   - Sender cannot message themselves.
//   - Both users must exist.
//   - Receiver must allow messages (privacy.allowMessages on User).
//   - The two users must already be friends (messaging is friends-only).
app.post("/api/messages", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);
    const text =
      typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (!sender || !receiver || text === "") {
      return res.status(400).json({
        error: "Please provide senderUsername, receiverUsername, and text.",
      });
    }

    if (sender === receiver) {
      return res
        .status(400)
        .json({ error: "You cannot send a message to yourself." });
    }

    const senderUser = await findUserByUsername(sender);
    if (!senderUser) {
      return res.status(404).json({ error: "Sender user not found." });
    }

    const receiverUser = await findUserByUsername(receiver);
    if (!receiverUser) {
      return res.status(404).json({ error: "Receiver user not found." });
    }

    const recvPrivacy = normalizeUserPrivacy(receiverUser);
    if (!recvPrivacy.allowMessages) {
      return res.status(403).json({
        error: "This user does not accept direct messages.",
      });
    }

    // Only friends can message each other.
    const areFriends =
      Array.isArray(senderUser.friends) &&
      senderUser.friends.includes(receiver);
    if (!areFriends) {
      return res.status(403).json({
        error: "You can only message users who are your friends.",
      });
    }

    const newMessage = await Message.create({
      senderUsername: sender,
      receiverUsername: receiver,
      text,
    });

    io.to(userRoom(receiver)).emit("newMessage", {
      id: newMessage.id,
      senderUsername: newMessage.senderUsername,
      receiverUsername: newMessage.receiverUsername,
      text: newMessage.text,
      createdAt: newMessage.createdAt,
      read: newMessage.read,
    });
    console.log("[socket] emitted newMessage", {
      room: userRoom(receiver),
      sender: newMessage.senderUsername,
      receiver: newMessage.receiverUsername,
      messageId: newMessage.id,
    });

    res.status(201).json({
      message: "Message sent.",
      data: newMessage,
    });
  } catch (err) {
    console.error("POST /api/messages failed:", err);
    res.status(500).json({ error: "Could not send message." });
  }
});

// GET /api/messages/:userA/:userB
// Returns every message exchanged between userA and userB, oldest first.
// Both directions (A→B and B→A) are included so the frontend can render a
// continuous thread. Usernames are normalized before the query so casing
// in the URL doesn't matter.
app.get("/api/messages/:userA/:userB", async (req, res) => {
  try {
    const userA = normalizeUsername(req.params.userA);
    const userB = normalizeUsername(req.params.userB);

    if (!userA || !userB) {
      return res.status(400).json({ error: "Invalid username(s)." });
    }

    if (userA === userB) {
      return res
        .status(400)
        .json({ error: "userA and userB must be different users." });
    }

    // Fetch both directions in one query using $or so the result is a
    // single chronological thread rather than two separate half-threads.
    const messages = await Message.find({
      $or: [
        { senderUsername: userA, receiverUsername: userB },
        { senderUsername: userB, receiverUsername: userA },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    // .lean() skips toJSON, so shape the payload explicitly.
    res.json(
      messages.map((m) => ({
        id: m._id.toString(),
        senderUsername: m.senderUsername,
        receiverUsername: m.receiverUsername,
        text: m.text,
        createdAt: m.createdAt,
        read: m.read,
      }))
    );
  } catch (err) {
    console.error("GET /api/messages/:userA/:userB failed:", err);
    res.status(500).json({ error: "Could not load messages." });
  }
});

// GET /api/conversations/:username
// Returns an inbox summary: one entry per friend the user has exchanged at
// least one message with, including the most recent message in that thread.
// Sorted newest-last-message first so the inbox feels natural.
//
// Implementation uses an aggregation pipeline:
//   1. Match all messages where this user is sender or receiver.
//   2. Add a "partner" field (the other participant's username).
//   3. Sort within the pipeline (needed before $group picks $last).
//   4. Group by partner, keeping the last message fields.
//   5. Sort the groups by the last message date descending.
app.get("/api/conversations/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const conversations = await Message.aggregate([
      // Step 1: only messages involving this user.
      {
        $match: {
          $or: [
            { senderUsername: username },
            { receiverUsername: username },
          ],
        },
      },
      // Step 2: tag each message with who the "other" participant is.
      {
        $addFields: {
          partner: {
            $cond: {
              if: { $eq: ["$senderUsername", username] },
              then: "$receiverUsername",
              else: "$senderUsername",
            },
          },
        },
      },
      // Step 3: sort oldest→newest so $last picks the most recent message.
      { $sort: { createdAt: 1 } },
      // Step 4: one document per partner, keeping the latest message fields.
      {
        $group: {
          _id: "$partner",
          lastMessageText: { $last: "$text" },
          lastMessageAt: { $last: "$createdAt" },
          lastMessageSender: { $last: "$senderUsername" },
          lastMessageRead: { $last: "$read" },
        },
      },
      // Step 5: most recent conversation first.
      { $sort: { lastMessageAt: -1 } },
    ]);

    const rows = conversations.map((c) => ({
      partner: c._id,
      lastMessage: {
        text: c.lastMessageText,
        createdAt: c.lastMessageAt,
        senderUsername: c.lastMessageSender,
        read: c.lastMessageRead,
      },
    }));

    const partnerKeys = [
      ...new Set(
        rows
          .map((r) => normalizeUsername(String(r.partner || "")))
          .filter(Boolean)
      ),
    ];

    let profileByLower = new Map();
    if (partnerKeys.length > 0) {
      const partnerUsers = await User.find({
        usernameLower: { $in: partnerKeys },
      }).lean();
      profileByLower = new Map(
        partnerUsers.map((u) => {
          const lower =
            u.usernameLower || normalizeUsername(u.username) || "";
          return [lower, publicProfile(u)];
        })
      );
    }

    res.json(
      rows.map((r) => {
        const lower = normalizeUsername(String(r.partner || ""));
        const partnerProfile =
          profileByLower.get(lower) ||
          ({
            username: r.partner,
            name: "",
            displayName: "",
            fullName: "",
            profilePicture: "",
            profilePictureType: "default",
            hobbies: [],
            interests: [],
          });
        return { ...r, partnerProfile };
      })
    );
  } catch (err) {
    console.error("GET /api/conversations/:username failed:", err);
    res.status(500).json({ error: "Could not load conversations." });
  }
});

// PATCH /api/messages/read
// Marks all messages sent FROM senderUsername TO receiverUsername as read.
// Body: { senderUsername, receiverUsername }
// Idempotent: calling it when messages are already read is a no-op (200).
app.patch("/api/messages/read", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const result = await Message.updateMany(
      { senderUsername: sender, receiverUsername: receiver, read: false },
      { $set: { read: true } }
    );

    res.json({
      message: "Messages marked as read.",
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("PATCH /api/messages/read failed:", err);
    res.status(500).json({ error: "Could not mark messages as read." });
  }
});

// =========================
// GROUP CHATS (MULTI-PARTY ROOMS + SOCKET BROADCAST)
// =========================

// POST /api/groupchats
// Body: { name, creatorUsername, members }
// Creates a group; creator is always included in members. Every member must
// exist as a User.
app.post("/api/groupchats", async (req, res) => {
  try {
    const rawName = req.body.name;
    const creator = normalizeUsername(req.body.creatorUsername);
    const rawMembers = req.body.members;

    if (typeof rawName !== "string" || rawName.trim() === "") {
      return res.status(400).json({ error: "Please provide a non-empty name." });
    }

    if (!creator) {
      return res.status(400).json({
        error: "Please provide creatorUsername.",
      });
    }

    if (!Array.isArray(rawMembers)) {
      return res.status(400).json({
        error: "members must be an array of usernames.",
      });
    }

    const memberSet = new Set();
    memberSet.add(creator);
    for (let i = 0; i < rawMembers.length; i++) {
      const n = normalizeUsername(rawMembers[i]);
      if (n) memberSet.add(n);
    }

    const memberList = Array.from(memberSet);
    for (let i = 0; i < memberList.length; i++) {
      const u = await findUserByUsername(memberList[i]);
      if (!u) {
        return res.status(404).json({
          error: "User not found: " + memberList[i],
        });
      }
    }

    const created = await GroupChat.create({
      name: rawName.trim(),
      creatorUsername: creator,
      members: memberList,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/groupchats failed:", err);
    res.status(500).json({ error: "Could not create group chat." });
  }
});

// GET /api/groupchats/:username
// All group chats where this user appears in members (newest first).
app.get("/api/groupchats/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const chats = await GroupChat.find({ members: username })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      chats.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        creatorUsername: c.creatorUsername,
        members: c.members,
        createdAt: c.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/groupchats/:username failed:", err);
    res.status(500).json({ error: "Could not load group chats." });
  }
});

// POST /api/groupchats/:id/messages
// Body: { senderUsername, text } — sender must be a member of the group.
app.post("/api/groupchats/:id/messages", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const sender = normalizeUsername(req.body.senderUsername);
    const text =
      typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (!sender || text === "") {
      return res.status(400).json({
        error: "Please provide senderUsername and text.",
      });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    const members = Array.isArray(group.members) ? group.members : [];
    if (!members.includes(sender)) {
      return res.status(403).json({
        error: "Only group members can post messages.",
      });
    }

    const senderUser = await findUserByUsername(sender);
    if (!senderUser) {
      return res.status(404).json({ error: "Sender user not found." });
    }

    const newMessage = await GroupChatMessage.create({
      groupChatId: id,
      senderUsername: sender,
      text,
    });

    io.to(groupRoom(id)).emit("newGroupMessage", {
      id: newMessage.id,
      groupChatId: String(newMessage.groupChatId),
      senderUsername: newMessage.senderUsername,
      text: newMessage.text,
      createdAt: newMessage.createdAt,
    });

    res.status(201).json({
      message: "Group message sent.",
      data: {
        id: newMessage.id,
        groupChatId: String(newMessage.groupChatId),
        senderUsername: newMessage.senderUsername,
        text: newMessage.text,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/groupchats/:id/messages failed:", err);
    res.status(500).json({ error: "Could not send group message." });
  }
});

// GET /api/groupchats/:id/messages
// All messages in the group, oldest first.
app.get("/api/groupchats/:id/messages", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const groupExists = await GroupChat.exists({ _id: id });
    if (!groupExists) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    const messages = await GroupChatMessage.find({ groupChatId: id })
      .sort({ createdAt: 1 })
      .lean();

    res.json(
      messages.map((m) => ({
        id: m._id.toString(),
        groupChatId: String(m.groupChatId),
        senderUsername: m.senderUsername,
        text: m.text,
        createdAt: m.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/groupchats/:id/messages failed:", err);
    res.status(500).json({ error: "Could not load group messages." });
  }
});

// DELETE /api/groupchats/:id
// Body: { username } — only the group's creator can delete the group.
// Deletes the group chat row and all messages tied to it.
app.delete("/api/groupchats/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ error: "Please provide username." });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    if (group.creatorUsername !== username) {
      return res.status(403).json({
        error: "Only the group creator can delete this group.",
      });
    }

    await Promise.all([
      GroupChat.deleteOne({ _id: id }),
      GroupChatMessage.deleteMany({ groupChatId: id }),
    ]);

    res.status(200).json({ message: "Group chat deleted." });
  } catch (err) {
    console.error("DELETE /api/groupchats/:id failed:", err);
    res.status(500).json({ error: "Could not delete group chat." });
  }
});

// DELETE /api/groupchats/:id/members
// Body: { username } — removes a member from the group.
app.delete("/api/groupchats/:id/members", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ error: "Please provide username." });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    if (group.creatorUsername === username) {
      return res.status(400).json({
        error: "The creator cannot be removed. Delete the group instead.",
      });
    }

    await GroupChat.updateOne({ _id: id }, { $pull: { members: username } });

    const leavePayload = {
      groupChatId: String(id),
      type: "leave",
      username: username,
    };
    io.to(groupRoom(id)).emit("groupMemberChange", leavePayload);
    console.log("[socket] emitted groupMemberChange", { room: groupRoom(id), payload: leavePayload });

    const updated = await GroupChat.findById(id).lean();

    res.status(200).json({
      message: "Member removed.",
      group: {
        id: updated._id.toString(),
        name: updated.name,
        creatorUsername: updated.creatorUsername,
        members: updated.members,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("DELETE /api/groupchats/:id/members failed:", err);
    res.status(500).json({ error: "Could not remove group member." });
  }
});

// POST /api/groupchats/:id/members
// Body: { username } — adds an existing user to members.
app.post("/api/groupchats/:id/members", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ error: "Please provide username." });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    const members = Array.isArray(group.members) ? group.members : [];
    if (members.includes(username)) {
      return res.status(400).json({
        error: "User is already a member of this group.",
      });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    await GroupChat.updateOne({ _id: id }, { $addToSet: { members: username } });

    const joinPayload = {
      groupChatId: String(id),
      type: "join",
      username: username,
    };
    io.to(groupRoom(id)).emit("groupMemberChange", joinPayload);
    console.log("[socket] emitted groupMemberChange", { room: groupRoom(id), payload: joinPayload });

    const updated = await GroupChat.findById(id).lean();
    res.status(201).json({
      message: "Member added.",
      group: {
        id: updated._id.toString(),
        name: updated.name,
        creatorUsername: updated.creatorUsername,
        members: updated.members,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/groupchats/:id/members failed:", err);
    res.status(500).json({ error: "Could not add group member." });
  }
});

// =========================
// BOOT: LISTEN FOR HTTP + WEBSOCKET UPGRADES
// =========================
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
