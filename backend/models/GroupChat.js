const mongoose = require("mongoose");

// GroupChat model — named group conversations with a fixed member list.
// Usernames in creatorUsername and members are stored lowercase (same as
// User.friends / direct Message routes) for case-insensitive matching.
const groupChatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  creatorUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  members: {
    type: [{ type: String, trim: true, lowercase: true }],
    default: [],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

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
