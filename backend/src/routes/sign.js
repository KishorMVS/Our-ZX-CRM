const express = require("express");
const router  = express.Router();
const { getSigningPage, getSigningPdf, downloadSignedPdf, submitSignature } = require("../controllers/signController");

// All routes are public — no auth middleware
router.get ("/:token",          getSigningPage);
router.get ("/:token/pdf",      getSigningPdf);
router.get ("/:token/download", downloadSignedPdf);
router.post("/:token",          submitSignature);

module.exports = router;
