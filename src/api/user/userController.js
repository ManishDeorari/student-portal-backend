
module.exports = {
  getMyProfile: require("./profile/getMyProfile"),
  updateMyProfile: require("./profile/updateMyProfile"),
  updateBanner: require("./profile/updateBanner"),
  getPublicProfile: require("./profile/getPublicProfile"),
  getAllUsers: require("./getUsers/getAllUsers"),

  getConnectedUsers: require("./connections/getConnectedUsers"),
  sendConnectionRequest: require("./connections/sendConnectionRequest"),
  acceptConnectionRequest: require("./connections/acceptConnectionRequest"),

  addPoints: require("./points/addPoints"),
  getAwardEligibleUsers: require("./award/getAwardEligibleUsers"),

  getMyPosts: require("./profile/getMyPosts"),

  getMyActivity: require("./profile/getMyActivity"),
  searchUsers: require("./getUsers/searchUsers"),
};
