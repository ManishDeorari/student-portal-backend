const Registration = require("../../../../models/Registration");
const Event = require("../../../../models/Event");

const downloadCSV = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!req.user.isAdmin && req.user.role !== 'faculty') {
      return res.status(403).json({ message: "Not authorized" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const registrations = await Registration.find({ eventId })
      .populate("userId", "name email enrollmentNumber")
      .sort({ createdAt: 1 }); // Persistent order by entry time

    if (registrations.length === 0) {
      return res.status(404).json({ message: "No registrations found" });
    }

    const baseFields = Object.keys(event.registrationFields || {}).filter(field => event.registrationFields[field] === true);
    const baseHeaders = baseFields.map(field => field.replace(/([A-Z])/g, ' $1').trim());
    
    // Core headers
    let headers = ["Group Name", ...baseHeaders];
    
    // Identify if group tracking is needed
    if (event.allowGroupRegistration) {
      headers.push("Group Role", "Led By");
    }
    
    headers.push("Registration Date");
    
    // Add custom questions to headers
    event.customQuestions.forEach(q => headers.push(q.question));

    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";
    let groupIndex = 1;

    registrations.forEach(reg => {
      const user = reg.userId || {};
      const groupLabel = `Group ${groupIndex++}`;
      const row = [];

      // Prepend Group Name
      row.push(`"${groupLabel}"`);

      // 1. Team Lead Data 
      baseFields.forEach(field => {
        let answer = reg.answers?.get ? reg.answers.get(field) : reg.answers?.[field];
        if (!answer) answer = user[field] || "";
        row.push(`"${String(answer).replace(/"/g, '""')}"`);
      });

      if (event.allowGroupRegistration) {
         row.push(`"${reg.isGroup ? "Team Lead" : "Individual"}"`);
         row.push('""'); // Team leads are not led by anyone
      }

      row.push(`"${new Date(reg.registeredAt).toLocaleString()}"`);

      // Add answers to custom questions (ONLY for Team Lead / Individual)
      event.customQuestions.forEach(q => {
        const answer = reg.answers?.get ? reg.answers.get(q.question) : reg.answers?.[q.question];
        row.push(`"${String(answer || "").replace(/"/g, '""')}"`);
      });

      csvContent += row.join(",") + "\n";

      // 2. Group Members Iteration 
      if (event.allowGroupRegistration && reg.isGroup && reg.groupMembers?.length > 0) {
        reg.groupMembers.forEach(member => {
            const memberRow = [];
            
            // Prepend Group Name (Persistent for the whole group)
            memberRow.push(`"${groupLabel}"`);

            // Map member fields to matching baseFields 
            baseFields.forEach(field => {
                 const isPhone = field === "phoneNumber" || field === "mobileNumber";
                 const key = isPhone ? "mobile" : field;
                 let val = member[key] || "";
                 memberRow.push(`"${String(val).replace(/"/g, '""')}"`);
            });

            // Group Tracking
            memberRow.push('"Group Member"');
            // Link to team lead (email or name)
            memberRow.push(`"${String(user.email || user.name || "Unknown").replace(/"/g, '""')}"`);

            // Registration Date
            memberRow.push(`"${new Date(reg.registeredAt).toLocaleString()}"`);

            // Custom Questions (Now populated for group members)
            event.customQuestions.forEach(q => {
                const answer = member[q.question] || "";
                memberRow.push(`"${String(answer).replace(/"/g, '""')}"`);
            });

            csvContent += memberRow.join(",") + "\n";
        });
      }
    });

    const BOM = "\uFEFF";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=registrations_${event.title.replace(/\s+/g, "_")}.csv`);
    res.status(200).send(BOM + csvContent);
  } catch (error) {
    console.error("CSV download error:", error);
    res.status(500).json({ message: "Error generating CSV" });
  }
};

module.exports = downloadCSV;
