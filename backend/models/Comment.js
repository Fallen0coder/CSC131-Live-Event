const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Comment model — one document per user comment on an event.
// ---------------------------------------------------------------------------
// We keep comments in their own collection (instead of embedding arrays on
// Event) so GET queries stay fast and we can paginate later if needed.
//
// Profile picture fields are copied from the User document at post time so
// comments still look correct if the user later changes their avatar.
// ---------------------------------------------------------------------------

const COMMENT_TEXT_MAX = 2000;

const commentSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: COMMENT_TEXT_MAX,
    },
    creatorUsername: { type: String, required: true, trim: true },
    creatorProfilePicture: { type: String, default: "" },
    creatorProfilePictureType: {
      type: String,
      enum: ["default", "uploaded"],
      default: "default",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

commentSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.eventId = ret.eventId.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Comment", commentSchema);
module.exports.COMMENT_TEXT_MAX = COMMENT_TEXT_MAX;
