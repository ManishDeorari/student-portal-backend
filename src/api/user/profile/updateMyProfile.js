const User = require("../../../../models/User");
const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, profileImage, profileImageFocus, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present & not default
    if (
      oldImageUrl &&
      oldImageUrl.includes("res.cloudinary.com") &&
      !oldImageUrl.includes("default-profile.jpg")
    ) {
      const isRaw = oldImageUrl.includes("/raw/");
      const publicId = extractPublicId(oldImageUrl, isRaw);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { 
             invalidate: true, 
             resource_type: isRaw ? "raw" : "image" 
          });
          console.log(`🗑 Deleted old Cloudinary file: ${publicId}`);
        } catch (err) {
          console.error("❌ Failed to delete old file from Cloudinary:", err);
        }
      }
    }

    // ✅ Update user profile picture in DB only if provided
    const updates = {
      ...rest,
    };
    
    // Fetch current user to check existing points statuses and media
    const currentUser = await User.findById(req.user.id);
    
    // 🧹 Delete old Cloudinary experience images if they were removed
    if (currentUser && updates.experience && Array.isArray(updates.experience)) {
      const oldProofImages = currentUser.experience.map(e => e.proofImage).filter(img => img && img.includes("res.cloudinary.com"));
      const newProofImages = updates.experience.map(e => e.proofImage).filter(img => img && img.includes("res.cloudinary.com"));
      
      const deletedImages = oldProofImages.filter(img => !newProofImages.includes(img));
      
      for (const imgUrl of deletedImages) {
        const publicId = extractPublicId(imgUrl, false);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId, { invalidate: true });
            console.log(`🗑 Deleted old Cloudinary experience proof: ${publicId}`);
          } catch (err) {
            console.error(`❌ Failed to delete experience proof from Cloudinary (${publicId}):`, err);
          }
        }
      }
    }

    // 🧹 Delete old Cloudinary certificate images if they were removed
    if (currentUser && updates.certificates && Array.isArray(updates.certificates)) {
      const oldProofImages = currentUser.certificates.map(e => e.proofImage).filter(img => img && img.includes("res.cloudinary.com"));
      const newProofImages = updates.certificates.map(e => e.proofImage).filter(img => img && img.includes("res.cloudinary.com"));
      
      const deletedImages = oldProofImages.filter(img => !newProofImages.includes(img));
      
      for (const imgUrl of deletedImages) {
        const publicId = extractPublicId(imgUrl, false);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId, { invalidate: true });
            console.log(`🗑 Deleted old Cloudinary certificate proof: ${publicId}`);
          } catch (err) {
            console.error(`❌ Failed to delete certificate proof from Cloudinary (${publicId}):`, err);
          }
        }
      }
    }
    
    // 🧹 Delete old Cloudinary achievement images if they were removed
    if (currentUser && updates.achievements && Array.isArray(updates.achievements)) {
      const oldProofImages = currentUser.achievements.map(e => e.proofImage).filter(img => img && img.includes("res.cloudinary.com"));
      const newProofImages = updates.achievements.map(e => e.proofImage).filter(img => img && img.includes("res.cloudinary.com"));
      
      const deletedImages = oldProofImages.filter(img => !newProofImages.includes(img));
      
      for (const imgUrl of deletedImages) {
        const publicId = extractPublicId(imgUrl, false);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId, { invalidate: true });
            console.log(`🗑 Deleted old Cloudinary achievement proof: ${publicId}`);
          } catch (err) {
            console.error(`❌ Failed to delete achievement proof from Cloudinary (${publicId}):`, err);
          }
        }
      }
    }
    
    // 🔒 We no longer trust frontend pointsStatus for resume/links because it is now automated.
    delete updates.resumePointsStatus;
    delete updates.githubPointsStatus;
    delete updates.portfolioPointsStatus;

    if (profileImage) {
      updates.profilePicture = profileImage;
    }
    if (profileImageFocus !== undefined) {
      updates.profileImageFocus = profileImageFocus;
    }

    // ✅ Preserve endorsements when updating profileSkills
    if (updates.profileSkills && currentUser) {
      const existingSkills = currentUser.profileSkills || [];
      updates.profileSkills = updates.profileSkills.map(newSkill => {
        const existing = existingSkills.find(
          s => s.name.toLowerCase() === newSkill.name.toLowerCase()
        );
        return {
          name: newSkill.name,
          endorsements: existing ? existing.endorsements : []
        };
      });
    }

    // ✅ Format education entries
    if (updates.education && Array.isArray(updates.education)) {
      updates.education = updates.education.map((edu) => {
        let startYear = null;
        let endYear = null;

        if (edu.startYear) startYear = Number(edu.startYear);
        else if (edu.startDate) startYear = Number(edu.startDate.split(" ").pop());

        if (edu.endYear) endYear = Number(edu.endYear);
        else if (edu.endDate) endYear = Number(edu.endDate.split(" ").pop());

        const formattedCourse = edu.course ? String(edu.course).toUpperCase() : "";
        let courseYearKey = null;
        
        if (formattedCourse && endYear && !isNaN(endYear)) {
          // e.g. MCA_2026
          courseYearKey = `${formattedCourse}_${endYear}`.toUpperCase();
        }

        return {
          ...edu,
          degree: edu.degree,
          course: formattedCourse || edu.course,
          branch: edu.branch || "",
          startYear: isNaN(startYear) ? null : startYear,
          endYear: isNaN(endYear) ? null : endYear,
          courseYearKey
        };
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    // ✅ Award / Deduct Points Logic (Strict Checklist)
    if (updatedUser.role === "student" || updatedUser.role === "alumni") {
      const config = await PointsSystemConfig.findOne() || { profileCompletionPoints: 50 };

      const hasProfilePic = updatedUser.profilePicture && !updatedUser.profilePicture.includes("default-profile.jpg");
      const hasBanner = updatedUser.bannerImage && !updatedUser.bannerImage.includes("default_banner.jpg");
      const hasPhone = updatedUser.phone && updatedUser.phone !== "Not provided" && updatedUser.phone.replace(/\D/g, "").length >= 7;
      const hasAddress = updatedUser.address && updatedUser.address !== "Not set";
      const hasWhatsApp = updatedUser.whatsapp && updatedUser.whatsapp !== "Not linked";
      const hasLinkedIn = updatedUser.linkedin && updatedUser.linkedin !== "Not linked";
      const hasBio = updatedUser.bio && updatedUser.bio.trim().length > 0;
      const hasSecondaryEmail = updatedUser.secondaryEmail && updatedUser.secondaryEmail.trim().length > 0;
      const hasUniversityRollNumber = updatedUser.universityRollNumber && updatedUser.universityRollNumber.trim().length > 0;

      // ✅ Revised Education Logic: Mandatory 4 Levels
      const MANDATORY_DEGREES = [
        "High School (Secondary - Class 10)",
        "Intermediate (Higher Secondary - Class 12)",
        "Undergraduate (Bachelor's Degree)",
        "Postgraduate (Master's Degree)"
      ];

      const userEducations = updatedUser.education || [];
      const completedMandatoryCount = MANDATORY_DEGREES.filter(degree => {
        const found = userEducations.find(e => e.level === degree || e.degree === degree);
        return found && found.institution && found.startDate && found.endDate;
      }).length;

      const hasEducation = completedMandatoryCount >= 3;
      const hasExperience = updatedUser.experience && updatedUser.experience.length > 0;

      const hasWorkProfile = updatedUser.workProfile &&
        (updatedUser.workProfile.functionalArea || updatedUser.workProfile.industry);

      const hasJobPreferences = updatedUser.jobPreferences &&
        (updatedUser.jobPreferences.functionalArea || updatedUser.jobPreferences.preferredLocations?.length > 0);

      const isCompleted = hasProfilePic && hasBanner && hasPhone && hasAddress &&
        hasWhatsApp && hasLinkedIn && hasBio && hasEducation && hasSecondaryEmail && hasUniversityRollNumber;

      if (isCompleted && !updatedUser.profileCompletionAwarded) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const awardAmount = config.profileCompletionPoints || 50;

        updatedUser.points.total = (updatedUser.points.total || 0) + awardAmount;
        updatedUser.points.profileCompletion = (updatedUser.points.profileCompletion || 0) + awardAmount;

        updatedUser.profileCompletionAwarded = true;
        updatedUser.markModified('points');
        await updatedUser.save();

        // ✅ Notification for points
        try {
          const Notification = require("../../../../models/Notification");
          const newNotification = new Notification({
            sender: updatedUser._id, // User is the sender (UI will handle "System" label)
            receiver: updatedUser._id,
            type: "points_earned",
            message: `You earned ${awardAmount} points by Profile completion.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            // 🔄 Emit pointsUpdated so UI reflects it immediately
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: awardAmount,
              reason: "Profile Completion",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send profile completion award notice:", noteErr.message);
        }

        console.log(`✅ Awarded ${awardAmount} points to user ${updatedUser.name} for FULL profile completion.`);
      } else if (!isCompleted && updatedUser.profileCompletionAwarded) {
        // ❌ Deduct Points Logic if profile becomes incomplete
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const awardAmount = config.profileCompletionPoints || 50;

        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) - awardAmount);
        updatedUser.points.profileCompletion = Math.max(0, (updatedUser.points.profileCompletion || 0) - awardAmount);

        updatedUser.profileCompletionAwarded = false;
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: "points_deducted",
            message: `You lost ${awardAmount} points because your profile is no longer complete.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            // 🔄 Emit pointsUpdated so UI reflects it immediately
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: -awardAmount,
              reason: "Profile Incomplete",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send profile completion deduction notice:", noteErr.message);
        }

        console.log(`❌ Deducted ${awardAmount} points from user ${updatedUser.name} due to incomplete profile.`);
      }
    }

    // ✅ Automatic Skills Points Logic (Max 10)
    if (updatedUser.role === "student" || updatedUser.role === "alumni") { // The user requested for both
      const currentSkillsCount = updatedUser.profileSkills ? updatedUser.profileSkills.length : 0;
      const newEligiblePoints = Math.min(currentSkillsCount, 10);
      const currentAwarded = updatedUser.pointsAwardedForSkills || 0;
      const pointsDifference = newEligiblePoints - currentAwarded;

      if (pointsDifference !== 0) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        
        // 👤 Shift all profile-related points to the Profile Completion category
        const engagementField = "profileCompletion";
        
        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) + pointsDifference);
        updatedUser.points[engagementField] = Math.max(0, (updatedUser.points[engagementField] || 0) + pointsDifference);
        updatedUser.pointsAwardedForSkills = newEligiblePoints;
        
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const typeStr = pointsDifference > 0 ? "points_earned" : "points_deducted";
          const actionStr = pointsDifference > 0 ? "adding skills to your profile" : "removing skills from your profile";
          
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: typeStr,
            message: `You ${pointsDifference > 0 ? 'earned' : 'lost'} ${Math.abs(pointsDifference)} point(s) for ${actionStr}.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            // 🔄 Emit pointsUpdated so UI reflects it immediately
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: pointsDifference,
              reason: pointsDifference > 0 ? "Skills Added" : "Skills Removed",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send skills points notice:", noteErr.message);
        }
      }

      // ✅ Automatic Certificates Points Logic (Max 10, 2 points per certificate)
      const currentCertsCount = updatedUser.certificates 
        ? updatedUser.certificates.filter(cert => cert.proofImage && cert.proofImage.includes("res.cloudinary.com")).length 
        : 0;
      const newEligibleCertPoints = Math.min(currentCertsCount * 2, 10);
      const currentAwardedCerts = updatedUser.pointsAwardedForCertificates || 0;
      const certPointsDifference = newEligibleCertPoints - currentAwardedCerts;

      if (certPointsDifference !== 0) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        
        const engagementField = "profileCompletion"; // Grouping with profile points
        
        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) + certPointsDifference);
        updatedUser.points[engagementField] = Math.max(0, (updatedUser.points[engagementField] || 0) + certPointsDifference);
        updatedUser.pointsAwardedForCertificates = newEligibleCertPoints;
        
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const typeStr = certPointsDifference > 0 ? "points_earned" : "points_deducted";
          const actionStr = certPointsDifference > 0 ? "adding certificates to your profile" : "removing certificates from your profile";
          
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: typeStr,
            message: `You ${certPointsDifference > 0 ? 'earned' : 'lost'} ${Math.abs(certPointsDifference)} point(s) for ${actionStr}.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            // 🔄 Emit pointsUpdated so UI reflects it immediately
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: certPointsDifference,
              reason: certPointsDifference > 0 ? "Certificates Added" : "Certificates Removed",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send certificate points notice:", noteErr.message);
        }
      }

      // 🔗 Automatic Points Logic for Links and Resume
      let linkPointsDiff = 0;
      let linkReasons = [];

      // 1. Resume Link Check
      const hasResume = updatedUser.resume && updatedUser.resume.trim().length > 0;
      if (hasResume && updatedUser.resumePointsStatus !== "approved") {
        updatedUser.resumePointsStatus = "approved";
        linkPointsDiff += 10;
        linkReasons.push("Adding Resume Link");
      } else if (!hasResume && updatedUser.resumePointsStatus === "approved") {
        updatedUser.resumePointsStatus = "none";
        linkPointsDiff -= 10;
        linkReasons.push("Removing Resume Link");
      }

      // 2. Links Check (GitHub, Portfolio, CustomLinks) - Excluded LinkedIn as it's part of basic profile info
      const hasLinks = (updatedUser.github && updatedUser.github.trim().length > 0) ||
                       (updatedUser.portfolio && updatedUser.portfolio.trim().length > 0) ||
                       (updatedUser.customLinks && updatedUser.customLinks.length > 0);
                       
      if (hasLinks && updatedUser.portfolioPointsStatus !== "approved") {
        updatedUser.portfolioPointsStatus = "approved";
        linkPointsDiff += 10;
        linkReasons.push("Adding External Links");
      } else if (!hasLinks && updatedUser.portfolioPointsStatus === "approved") {
        updatedUser.portfolioPointsStatus = "none";
        linkPointsDiff -= 10;
        linkReasons.push("Removing External Links");
      }

      // 3. Experience/Internship Check
      // Condition: +10 per entry with a valid proofImage, max 3 entries = 30 pts
      const experienceWithProof = (updatedUser.experience || []).filter(exp => exp.proofImage && exp.proofImage.trim().length > 0);
      const newExperiencePoints = Math.min(experienceWithProof.length, 3) * 10;
      const currentExperiencePoints = updatedUser.pointsAwardedForExperience || 0;
      const experiencePointsDiff = newExperiencePoints - currentExperiencePoints;

      if (experiencePointsDiff !== 0) {
        updatedUser.pointsAwardedForExperience = newExperiencePoints;
        linkPointsDiff += experiencePointsDiff;
        linkReasons.push(experiencePointsDiff > 0 ? "Adding Experience/Internship Proof" : "Removing Experience/Internship Proof");
        // Clear old binary status field
        updatedUser.experiencePointsStatus = newExperiencePoints > 0 ? "approved" : "none";
      }

      if (linkPointsDiff !== 0) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const engagementField = "profileCompletion";
        
        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) + linkPointsDiff);
        updatedUser.points[engagementField] = Math.max(0, (updatedUser.points[engagementField] || 0) + linkPointsDiff);
        
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const typeStr = linkPointsDiff > 0 ? "points_earned" : "points_deducted";
          
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: typeStr,
            message: `You ${linkPointsDiff > 0 ? 'earned' : 'lost'} ${Math.abs(linkPointsDiff)} point(s) for ${linkReasons.join(" and ")}.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: linkPointsDiff,
              reason: linkReasons.join(" & "),
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send links/resume points notice:", noteErr.message);
        }
      }

      // ✅ Automatic Projects Points Logic (Max 30, 10 points per project with a link, max 3)
      if (updates.projects !== undefined) {
        // Auto-sort projects: Ongoing first, then by endDate descending, then by order of addition
        if (Array.isArray(updatedUser.projects)) {
          // Add original index for stable sort
          const indexedProjects = updatedUser.projects.map((p, index) => ({ p, index }));
          
          indexedProjects.sort((aObj, bObj) => {
            const a = aObj.p;
            const b = bObj.p;
            
            if (a.isOngoing && !b.isOngoing) return -1;
            if (!a.isOngoing && b.isOngoing) return 1;
            
            if (!a.isOngoing && !b.isOngoing) {
              const dateA = a.endDate ? new Date(a.endDate) : new Date(0);
              const dateB = b.endDate ? new Date(b.endDate) : new Date(0);
              if (dateB.getTime() !== dateA.getTime()) {
                return dateB.getTime() - dateA.getTime();
              }
            }
            
            // Both ongoing OR both same end date -> retain order of addition
            return aObj.index - bObj.index;
          });
          
          updatedUser.projects = indexedProjects.map(obj => obj.p);
          updatedUser.markModified('projects');
          await updatedUser.save();
        }
      }

      const eligibleProjects = (updatedUser.projects || [])
        .filter(p => p.link && p.link.trim().length > 0)
        .slice(0, 3); // Max 3 projects count for points
      
      const newEligibleProjectPoints = eligibleProjects.length * 10;
      const currentAwardedProjects = updatedUser.pointsAwardedForProjects || 0;
      const projectPointsDifference = newEligibleProjectPoints - currentAwardedProjects;

      if (projectPointsDifference !== 0) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const engagementField = "profileCompletion";
        
        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) + projectPointsDifference);
        updatedUser.points[engagementField] = Math.max(0, (updatedUser.points[engagementField] || 0) + projectPointsDifference);
        updatedUser.pointsAwardedForProjects = newEligibleProjectPoints;
        
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const typeStr = projectPointsDifference > 0 ? "points_earned" : "points_deducted";
          const actionStr = projectPointsDifference > 0 ? "adding projects with links to your profile" : "removing project links from your profile";
          
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: typeStr,
            message: `You ${projectPointsDifference > 0 ? 'earned' : 'lost'} ${Math.abs(projectPointsDifference)} point(s) for ${actionStr}.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: projectPointsDifference,
              reason: projectPointsDifference > 0 ? "Projects Added" : "Projects Removed",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send project points notice:", noteErr.message);
        }
      }

      // ✅ Automatic Research Papers Points Logic (Max 60, 20 points per paper with a link, max 3)
      if (updates.researchPapers !== undefined) {
        // Auto-sort papers by publishDate descending
        if (Array.isArray(updatedUser.researchPapers)) {
          const indexedPapers = updatedUser.researchPapers.map((p, index) => ({ p, index }));
          indexedPapers.sort((aObj, bObj) => {
            const dateA = aObj.p.publishDate ? new Date(aObj.p.publishDate) : new Date(0);
            const dateB = bObj.p.publishDate ? new Date(bObj.p.publishDate) : new Date(0);
            if (dateB.getTime() !== dateA.getTime()) {
              return dateB.getTime() - dateA.getTime();
            }
            return aObj.index - bObj.index;
          });
          updatedUser.researchPapers = indexedPapers.map(obj => obj.p);
          updatedUser.markModified('researchPapers');
          await updatedUser.save();
        }
      }

      const eligiblePapers = (updatedUser.researchPapers || [])
        .filter(p => p.link && p.link.trim().length > 0)
        .slice(0, 3); // Max 3 papers count for points
      
      const newEligiblePaperPoints = eligiblePapers.length * 20;
      const currentAwardedPapers = updatedUser.pointsAwardedForPapers || 0;
      const paperPointsDifference = newEligiblePaperPoints - currentAwardedPapers;

      if (paperPointsDifference !== 0) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const engagementField = "profileCompletion";
        
        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) + paperPointsDifference);
        updatedUser.points[engagementField] = Math.max(0, (updatedUser.points[engagementField] || 0) + paperPointsDifference);
        updatedUser.pointsAwardedForPapers = newEligiblePaperPoints;
        
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const typeStr = paperPointsDifference > 0 ? "points_earned" : "points_deducted";
          const actionStr = paperPointsDifference > 0 ? "adding research papers/patents with links to your profile" : "removing research/patent links from your profile";
          
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: typeStr,
            message: `You ${paperPointsDifference > 0 ? 'earned' : 'lost'} ${Math.abs(paperPointsDifference)} point(s) for ${actionStr}.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: paperPointsDifference,
              reason: paperPointsDifference > 0 ? "Publications Added" : "Publications Removed",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send research paper points notice:", noteErr.message);
        }
      }
      
      // ✅ Automatic Achievements Points Logic (Max 45, 15 points per achievement with proof image or link, max 3)
      if (updates.achievements !== undefined) {
        if (Array.isArray(updatedUser.achievements)) {
          updatedUser.achievements = updates.achievements;
          updatedUser.markModified('achievements');
          await updatedUser.save();
        }
      }

      const eligibleAchievements = (updatedUser.achievements || [])
        .filter(a => (a.link && a.link.trim().length > 0) || (a.proofImage && a.proofImage.trim().length > 0))
        .slice(0, 3); // Max 3 achievements count for points
      
      const newEligibleAchievementPoints = eligibleAchievements.length * 15;
      const currentAwardedAchievements = updatedUser.pointsAwardedForAchievements || 0;
      const achievementPointsDifference = newEligibleAchievementPoints - currentAwardedAchievements;

      if (achievementPointsDifference !== 0) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const engagementField = "profileCompletion";
        
        updatedUser.points.total = Math.max(0, (updatedUser.points.total || 0) + achievementPointsDifference);
        updatedUser.points[engagementField] = Math.max(0, (updatedUser.points[engagementField] || 0) + achievementPointsDifference);
        updatedUser.pointsAwardedForAchievements = newEligibleAchievementPoints;
        
        updatedUser.markModified('points');
        await updatedUser.save();

        try {
          const Notification = require("../../../../models/Notification");
          const typeStr = achievementPointsDifference > 0 ? "points_earned" : "points_deducted";
          const actionStr = achievementPointsDifference > 0 ? "adding verified achievements to your profile" : "removing verified achievements from your profile";
          
          const newNotification = new Notification({
            sender: updatedUser._id,
            receiver: updatedUser._id,
            type: typeStr,
            message: `You ${achievementPointsDifference > 0 ? 'earned' : 'lost'} ${Math.abs(achievementPointsDifference)} point(s) for ${actionStr}.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
            
            req.io.to(updatedUser._id.toString()).emit("pointsUpdated", {
              awardedPoints: achievementPointsDifference,
              reason: achievementPointsDifference > 0 ? "Achievements Added" : "Achievements Removed",
              totalPoints: updatedUser.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to send achievement points notice:", noteErr.message);
        }
      }
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔍 More robust extractPublicId
function extractPublicId(imageUrl, isRaw = false) {
  try {
    // Remove query params
    imageUrl = imageUrl.split("?")[0];

    // Find the part after /upload/
    const afterUpload = imageUrl.split("/upload/")[1];
    if (!afterUpload) return null;

    // Remove any version number like /v123456/
    const noVersion = afterUpload.replace(/v\d+\//, "");

    // For raw files, keep the extension!
    if (isRaw) return noVersion;

    // Remove file extension
    return noVersion.substring(0, noVersion.lastIndexOf(".")) || noVersion;
  } catch (e) {
    console.error("⚠️ Failed to extract public_id:", e.message);
    return null;
  }
}
module.exports = module.exports;