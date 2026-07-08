const postPopulateOptions = [
  { path: "user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total role isAdmin" },
  { path: "comments.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total role isAdmin" },
  { path: "comments.replies.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total role isAdmin" },
  { path: "announcementDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total role isAdmin" } },
  { path: "announcementDetails.winners.userId", select: "name profilePicture profileImageFocus bannerImageFocus publicId profileCompletionAwarded enrollmentNumber course semester points.total role isAdmin" },
  { path: "announcementDetails.winners.groupMembers", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded role isAdmin" },
  { path: "eventRepostDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total role isAdmin" } }
];

module.exports = postPopulateOptions;
