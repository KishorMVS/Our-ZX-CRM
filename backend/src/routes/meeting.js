const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const meetingController = require("../controllers/meetingController");

router.use(authMiddleware);

// Anyone authenticated can schedule and view their meetings.
router.post("/", meetingController.createMeeting);
router.get("/", meetingController.listMeetings);
router.patch("/:id/reminder", meetingController.updateMyReminder);
router.delete("/:id", meetingController.deleteMeeting);

module.exports = router;
