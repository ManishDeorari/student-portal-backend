const postPopulateOptions = [
  { path: "user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total" },
  { path: "comments.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total" },
  { path: "comments.replies.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total" },
  { path: "announcementDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total" } },
  { path: "announcementDetails.winners.userId", select: "name profilePicture profileImageFocus bannerImageFocus publicId profileCompletionAwarded enrollmentNumber course semester points.total" },
  { path: "announcementDetails.winners.groupMembers", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded" },
  { path: "eventRepostDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId points.total" } }
];

module.exports = postPopulateOptions;
