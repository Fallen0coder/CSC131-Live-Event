const mongoose = require("mongoose");

// =========================
// GROUP CHAT MESSAGE MODEL (one line in the thread)
// =========================
// Each document is one text message INSIDE one group (`groupChatId` → GroupChat `_id`).
// Kept separate from GroupChat so the room document stays small as history grows long.
//
// Frontend connection:
//   - POST /api/groupchats/:id/messages appends text after membership check; server emits Socket.IO
//     event `newGroupMessage` to room `group:<id>` so other members see it instantly.
//   - GET /api/groupchats/:id/messages returns chronological history after page reload.
//
// Permissions: Sending is checked in Express (must be on group.members[]); Mongo only stores facts.

const groupChatMessageSchema = new mongoose.Schema({
  // FK-style link to GroupChat `_id`; used in queries "all messages for this group".
  groupChatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GroupChat",
    required: true,
    index: true,
  },

  senderUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  text: {
    type: String,
    required: true,
    trim: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Speeds “load timeline for group X ordered oldest→newest” (see GET …/messages).
groupChatMessageSchema.index({ groupChatId: 1, createdAt: 1 });

groupChatMessageSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("GroupChatMessage", groupChatMessageSchema);
