require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cron = require("cron");
const mysql = require("mysql2");
const { google } = require("googleapis");
const dbConfig = require("./config.json");

// Setup variables from .env
const userEmail = process.env.DRIVE_USER_MAIL;
const backupDir = process.env.DRIVE_BACKUP_DIR;
const databases = dbConfig;

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
  const command = `mysqldump -h${database.hostname} --port ${database.port} -u${database.user} -p'${database.password}' ${database.name} > ${backupPath}`;

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
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "./credentials.json",
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    const backupDirId = await getOrCreateBackupFolder(drive, backupDir);

    const metaData = {
      name: path.basename(filePath),
      parents: [backupDirId],
    };

    const media = {
      mimeType: "application/sql",
      body: fs.createReadStream(filePath),
    };

    const res = await drive.files.create({
      fields: "id",
      media: media,
      resource: metaData,
    });

    console.info(`Uploaded ${databaseName} backup to Drive:`, res.data.id);

    // Clean up: Delete the backup file after uploading
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`Error uploading ${databaseName} backup to Drive:`, err);
  }
}

// Function to get the destination folder info
async function getOrCreateBackupFolder(
  drive,
  folderName,
  _userEmail = userEmail
) {
  try {
    const res = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id)",
    });

    let folderId;

    if (res.data.files.length > 0) {
      folderId = res.data.files[0].id;
      return folderId;
    }

    const folderMeta = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const createRes = await drive.files.create({
      fields: "id",
      resource: folderMeta,
    });

    folderId = createRes.data.id;

    if (_userEmail) {
      await drive.permissions.create({
        resource: {
          type: "user",
          role: "writer",
          emailAddress: _userEmail,
        },
        fileId: folderId,
        sendNotificationEmail: false,
      });
    }

    return folderId;
  } catch (error) {
    console.error("Error in getting folder ID:", error);
    return null;
  }
}

// Schedule  job (e.g., backup every day at 2:00 AM)
// const job = new cron.CronJob("*/1 * * * *", backupAllDatabases);
const job = new cron.CronJob("0 2 * * *", backupAllDatabases);
job.start();

module.exports = job;
