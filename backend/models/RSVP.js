const mongoose = require("mongoose");

// =========================
// RSVP MODEL (“I’m attending this event”)
// =========================
// Each document links ONE user → ONE event. That is stored as MongoDB ObjectIds:
// `userId` points at a User, `eventId` points at an Event.
//
// Why it exists: The events UI needs to know “who RSVP’d?” and users need a persistent
// “saved” response beyond localStorage alone.
//
// Frontend connection:
//   - POST /api/rsvp saves a row here (after login/signup gave the user.id).
//   - DELETE /api/rsvp removes the row (“cancel”).
//   - GET /api/rsvps/event/:eventId returns RSVP count plus every attendee’s *public*
//     username / display name / profile picture (cards + People Going modal + View Details).
//   - GET /api/rsvps/:username loads “events I’m going to” for a profile.
//
// Duplicate protection: Compound unique index below means the same pair (userId, eventId)
// can only appear once — the API also checks before inserting.
const rsvpSchema = new mongoose.Schema({
  // Who clicked RSVP — must match a real User row (server checks with User.exists).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Which campus event — must match a real Event row (server checks).
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
});

// Compound unique index — prevents double-RSVP in the database even under race conditions.
rsvpSchema.index({ userId: 1, eventId: 1 }, { unique: true });

rsvpSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("RSVP", rsvpSchema);
