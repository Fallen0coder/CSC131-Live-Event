const mongoose = require("mongoose");

// =========================
// GROUP CHAT MODEL (room metadata)
// =========================
// Describes one named group conversation: title, creator, and fixed member list.
// Actual chat lines live in GroupChatMessage (their own collection) so messages can grow
// without bloating each GroupChat document.
//
// Frontend connection:
//   - POST /api/groupchats creates a row here (creator + invite list).
//   - GET /api/groupchats/:username lists chats where username appears in members[].
//   - Clients call socket.emit("join-group", groupId) so live group messages arrive in that room.
//   - Creator-only: DELETE /api/groupchats/:id removes group + wipes related GroupChatMessages.
//
// Convention: creatorUsername and every entry in members[] are lowercased usernames —
// same canonical form as User.usernameLower — so lookups match Friend/Message routes.

const groupChatSchema = new mongoose.Schema({
  // Display title shown on the frontend group list/header.
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // Who created the chat (only they can DELETE the entire group via API rule).
  creatorUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  // Everyone who belongs in this group; server always normalizes strings to lowercase.
  members: {
    type: [{ type: String, trim: true, lowercase: true }],
    default: [],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index so “find every group where alice is in members[]” scales better with many chats.
groupChatSchema.index({ members: 1 });

groupChatSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("GroupChat", groupChatSchema);
