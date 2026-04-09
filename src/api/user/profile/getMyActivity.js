// controllers/profile/getMyActivity.js
const Post = require("../../../../models/Post");

const getMyActivity = async (req, res) => {
  try {
    const userId = req.user._id;

    const posts = await Post.find()
      .populate("user", "name profilePicture")
      .populate("comments.user", "name profilePicture")
      .populate("comments.replies.user", "name profilePicture")
      .sort({ createdAt: -1 });

    let activities = [];

    posts.forEach((post) => {
      // 🔹 Reactions on posts
      for (const [emoji, users] of post.reactions.entries()) {
        if (users.some((u) => String(u) === String(userId))) {
          activities.push({
            type: "reaction",
            reaction: emoji,
            post,
            createdAt: post.updatedAt,
          });
        }
      }

      // 🔹 Comments
      post.comments.forEach((comment) => {
        if (String(comment.user?._id) === String(userId)) {
          activities.push({
            type: "comment",
            text: comment.text,
            post,
            createdAt: comment.createdAt,
          });
        }

        // 🔹 Reactions on comments
        for (const [emoji, users] of (comment.reactions || new Map()).entries()) {
          if (users.some((u) => String(u) === String(userId))) {
            activities.push({
              type: "reaction",
              reaction: emoji,
              post,
              createdAt: comment.createdAt,
            });
          }
        }

        // 🔹 Replies
        comment.replies?.forEach((reply) => {
          if (String(reply.user?._id) === String(userId)) {
            activities.push({
              type: "reply",
              text: reply.text,
              post,
              createdAt: reply.createdAt,
            });
          }

          // 🔹 Reactions on replies
          for (const [emoji, users] of (reply.reactions || new Map()).entries()) {
            if (users.some((u) => String(u) === String(userId))) {
              activities.push({
                type: "reaction",
                reaction: emoji,
                post,
                createdAt: reply.createdAt,
              });
            }
          }
        });
      });
    });

    // 🔹 Sort newest first
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(
      activities.map((a) => {
        const postData = a.post?.toJSON ? a.post.toJSON() : a.post;
        return {
          ...a,
          post: postData,
        };
      })
    );

  } catch (err) {
    console.error("❌ Error fetching activity:", err.message);
    res.status(500).json({ message: "Failed to fetch activity" });
  }
};

module.exports = getMyActivity;
