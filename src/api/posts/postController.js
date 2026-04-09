const getMyPosts = require("./post/getMyPosts");

module.exports = {
  createPost: require("./post/createPost"),
  getPosts: require("./post/getPosts"),
  getMyPosts: require("./post/getMyPosts"),
  commentPost: require("./comment/commentPost"),
  replyToComment: require("./comment/replyToComment"),
  deleteComment: require("./comment/deleteComment"),
  editComment: require("./comment/editComment"),
  reactToPost: require("./post/reactToPost"),
  editPost: require("./post/editPost"),
  deletePost: require("./post/deletePost"),
  reactToComment: require("./comment/reactToComment"),
  reactToReply: require("./comment/reactToReply"),
  editReply: require("./comment/editReply"),
  deleteReply: require("./comment/deleteReply"),
};
