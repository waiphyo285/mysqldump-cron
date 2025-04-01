require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cron = require("cron");
const mysql = require("mysql2");
const { google } = require("googleapis");

// Parse MYSQL_DATABASES JSON string from .env
const databases = JSON.parse(process.env.MYSQL_DATABASES);

// MySQL connection setup function
function createConnection(database) {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: database.user,
    password: database.password,
  });
}

// Function to backup all databases
async function backupAllDatabases() {
  for (let db of databases) {
    await backupDatabase(db);
  }
}

// Function to backup a single database
async function backupDatabase(database) {
  const timestamp = new Date().toISOString().replace(/[-T:.]/g, "_");
  const backupPath = path.join(__dirname, `${database.name}_${timestamp}.sql`);
  const command = `mysqldump -u${database.user} -p${database.password} ${database.name} > ${backupPath}`;

  // Execute MySQL dump command
  const exec = require("child_process").exec;
  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error backing up database ${database.name}:`, err);
      return;
    }
    console.info(`Database ${database.name} backup completed:`, backupPath);
    uploadToGoogleDrive(backupPath, database.name);
  });
}

// Function to upload the backup to Google Drive
async function uploadToGoogleDrive(filePath, databaseName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  const metaData = {
    name: path.basename(filePath),
    parents: ["your_folder_id"],
  };

  const media = {
    mimeType: "application/sql",
    body: fs.createReadStream(filePath),
  };

  try {
    const res = await drive.files.create({
      resource: metaData,
      media: media,
      fields: "id",
    });
    console.info(`Uploaded ${databaseName} backup to Drive:`, res.data.id);

    // Clean up: Delete the backup file after uploading
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`Error uploading ${databaseName} backup to Drive:`, err);
  }
}

// Schedule  job (e.g., backup every day at 2:00 AM)
const job = new cron.CronJob("0 2 * * *", backupAllDatabases);
job.start();

module.exports = job;
