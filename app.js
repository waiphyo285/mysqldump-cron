const express = require("express");
const backupJob = require("./backup");

const app = express();
const port = process.env.API_PORT || 3000;

// Manually trigger backups for all databases via API
app.get("/trigger-backup", (req, res) => {
  backupJob.fire();
  res.send("Backup started...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
