const mongoose = require("mongoose");

// One message inside a group chat thread (separate collection so the
// GroupChat document stays small).
const groupChatMessageSchema = new mongoose.Schema({
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
