/**
 * Google Apps Script Code template for Pharmacozyme CMS v2.0
 * Deploy this script at script.google.com as a Web App to manage Drive uploads, Sheets tabs, and Email Reminders.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Pharmacozyme CMS v2.0 - Apps Script Backend, Multi-Tab Sheets & Email Reminder Manager
 *
 * INSTRUCTIONS:
 * 1. Go to https://script.google.com and click "New project"
 * 2. Erase any existing code and paste this ENTIRE script into Code.gs
 * 3. SUPABASE_URL and SUPABASE_ANON_KEY below are already filled in for this project —
 *    that's what lets the daily reminder trigger check for due posts on its own.
 *    No edit needed unless you move to a different Supabase project later.
 * 4. Click "Save project" (Ctrl+S or Cmd+S)
 * 5. IMPORTANT FOR EMAIL REMINDERS:
 *    - Select "doGet" or "handleSendEmailReminder" from the function dropdown at the top of Apps Script editor.
 *    - Click "Run".
 *    - Click "Review permissions" -> select your Google Account -> "Advanced" -> "Go to Pharmacozyme Backend (unsafe)" -> "Allow".
 * 6. Click "Deploy" -> "New deployment"
 * 7. Select type: "Web app"
 * 8. Set Description: "Pharmacozyme CMS Media, Multi-Tab Sheets & Email Backend"
 * 9. Set Execute as: "Me (your account)"
 * 10. Set Who has access: "Anyone" (CRITICAL for receiving uploads and requests)
 * 11. Click "Deploy"
 * 12. Copy the Web App URL (starts with https://script.google.com/macros/s/...). Paste it into the
 *     Integrations tab's tester to verify it first, then have an Owner set it as APPS_SCRIPT_URL in
 *     Vercel's project environment variables — that's what makes uploads and reminders work for the
 *     whole team, not just the browser that pasted it.
 * 13. In the app's Integrations tab, click "Enable Scheduled Reminders" once — this installs a
 *     trigger that runs sendDueReminders() every 5 minutes, sending each post's reminder
 *     around its own scheduled time instead of only when someone clicks "Send" by hand.
 * 14. REQUIRED once migration 0018 is applied: in Apps Script -> Project Settings ->
 *     Script Properties, add a property named REMINDER_RPC_SECRET whose value is the
 *     output of this SQL in the Supabase SQL editor:
 *        select value from private.app_secrets where name = 'reminder_rpc_secret';
 *     The reminder RPCs reject the call without it, so the trigger sends nothing until
 *     this is set. (Optional: REMINDER_TIMEZONE to override the default Asia/Karachi.)
 */

// Global Configuration
const DRIVE_FOLDER_NAME = "Pharmacozyme CMS Uploads";
const SPREADSHEET_NAME = "Pharmacozyme Content Schedule";

// Fill these in from the app's Settings -> System panel so the daily trigger
// can read due posts directly from Supabase (this script runs on Google's
// servers on a timer, not from the browser, so it needs its own credentials).
const SUPABASE_URL = "https://sgevopyvcsclkasvekah.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXZvcHl2Y3NjbGthc3Zla2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDE0NDUsImV4cCI6MjEwMTUxNzQ0NX0.EcxxNypg_7Bm6egjHd49Q5KhX5jm_m0zrHfKt5DZ6yo";

// Tab Names & Theme Colors
const TAB_CONFIGS = [
  { name: "Master Schedule", color: "#296C00", fontColor: "#FFFFFF" },
  { name: "Pharmacozyme", color: "#296C00", fontColor: "#FFFFFF", brandId: "pharmacozyme" },
  { name: "PZ Academy", color: "#5A38F0", fontColor: "#FFFFFF", brandId: "pz-academy" },
  { name: "MED-Q", color: "#296951", fontColor: "#FFFFFF", brandId: "med-q" },
  { name: "PillZ", color: "#07513B", fontColor: "#FFFFFF", brandId: "pillz" },
  { name: "PrescriptionZ", color: "#30312E", fontColor: "#FFFFFF", brandId: "prescriptionz" },
  { name: "Team Roster", color: "#707A67", fontColor: "#FFFFFF", isTeam: true }
];

/**
 * Handles GET requests (Health check)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      message: "Pharmacozyme Apps Script Backend is online and active!",
      timestamp: new Date().toISOString(),
      driveFolder: DRIVE_FOLDER_NAME,
      sheetName: SPREADSHEET_NAME
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles POST requests (Drive Uploads, Multi-Tab Sheets Sync, Email Reminders)
 */
function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : null;
    if (!contents) {
      throw new Error("No payload data received.");
    }
    
    var data = JSON.parse(contents);
    var action = data.action || "upload";
    
    if (action === "health" || action === "ping") {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: "success",
          message: "Pharmacozyme Apps Script Backend is online and responding to POST requests!",
          timestamp: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "upload") {
      return handleFileUpload(data);
    } else if (action === "uploadResearchFile") {
      return handleUploadResearchFile(data);
    } else if (action === "syncAllPosts" || action === "syncPost") {
      return handleSyncMultiTabSheets(data);
    } else if (action === "sendEmailReminder" || action === "sendTestEmail") {
      return handleSendEmailReminder(data);
    } else if (action === "installReminderTrigger") {
      return handleInstallReminderTrigger();
    } else if (action === "reminderTriggerStatus") {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", installed: isReminderTriggerInstalled() }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error("Unknown action requested: " + action);
    }
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        error: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper: Get or Create Google Drive Folder
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

/**
 * Helper: Upload Base64 string directly to Drive and return clean direct URL
 */
function uploadBase64ToDrive(base64Str, fileName) {
  try {
    if (!base64Str || typeof base64Str !== "string") return base64Str;
    if (base64Str.indexOf("data:") !== 0 && base64Str.indexOf(";base64,") === -1) {
      return base64Str; // Already a URL
    }
    
    var base64Clean = base64Str;
    var mimeType = "image/png";
    
    if (base64Clean.indexOf(",") !== -1) {
      var parts = base64Clean.split(",");
      if (parts[0].indexOf("data:") === 0) {
        mimeType = parts[0].split(";")[0].replace("data:", "") || "image/png";
      }
      base64Clean = parts[1];
    }
    
    var fileTitle = fileName || ("PZ_Asset_" + Date.now() + ".png");
    var decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Clean), mimeType, fileTitle);
    var folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
    var file = folder.createFile(decodedBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (err) {
    Logger.log("Failed to convert base64 to Drive: " + err.toString());
    return base64Str;
  }
}

/**
 * Handles File Uploads to Google Drive
 */
function handleFileUpload(data) {
  if (!data.fileName || !data.base64Data) {
    throw new Error("Missing fileName or base64Data in payload.");
  }
  
  var directUrl = uploadBase64ToDrive(data.base64Data, data.fileName);
  
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      message: "File uploaded successfully to Google Drive",
      fileName: data.fileName,
      url: directUrl,
      driveViewUrl: directUrl
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper: Get or create a nested Drive folder path, creating each missing
 * level. e.g. ["Research & Plans", "pharmacozyme", "calendar"] walks/creates
 * "Research & Plans" -> "pharmacozyme" -> "calendar" under My Drive.
 */
function getOrCreateNestedFolder(pathParts) {
  var current = DriveApp.getRootFolder();
  for (var i = 0; i < pathParts.length; i++) {
    var name = pathParts[i];
    var existing = current.getFoldersByName(name);
    current = existing.hasNext() ? existing.next() : current.createFolder(name);
  }
  return current;
}

/**
 * Handles Research & Plans file uploads (any file type -- CSV, XLSX, MD,
 * DOCX, PDF) into "Research & Plans / {brand} / {type}". Unlike
 * uploadBase64ToDrive/handleFileUpload above (image-only, used for post
 * visuals, returns just an image-CDN URL), this returns the real Drive
 * fileId and webViewLink the CMS needs to store and link back to, and works
 * for any mime type.
 */
function handleUploadResearchFile(data) {
  if (!data.fileName || !data.base64Data || !data.brand || !data.type) {
    throw new Error("Missing fileName, base64Data, brand, or type in payload.");
  }

  var mimeType = data.mimeType || "application/octet-stream";
  var base64Clean = data.base64Data;
  if (base64Clean.indexOf("data:") === 0 && base64Clean.indexOf(",") !== -1) {
    var parts = base64Clean.split(",");
    mimeType = parts[0].split(";")[0].replace("data:", "") || mimeType;
    base64Clean = parts[1];
  }

  var decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Clean), mimeType, data.fileName);
  var folder = getOrCreateNestedFolder(["Research & Plans", data.brand, data.type]);
  var file = folder.createFile(decodedBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      message: "File uploaded to Research & Plans",
      fileId: file.getId(),
      webViewLink: file.getUrl(),
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper: Get or Create Google Sheet Spreadsheet
 */
function getOrCreateSpreadsheet(sheetName) {
  var files = DriveApp.getFilesByName(sheetName);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  } else {
    return SpreadsheetApp.create(sheetName);
  }
}

/**
 * Handles Atomic Multi-Tab Syncing to Google Sheets using setValues()
 * Organizes data into 7 dedicated tabs in bulk without row flickering
 */
function handleSyncMultiTabSheets(data) {
  var posts = data.posts || (data.post ? [data.post] : []);
  var teamMembers = data.teamMembers || [];
  var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME);
  
  // Pre-process any base64 images into Google Drive URLs
  for (var k = 0; k < posts.length; k++) {
    if (posts[k].visualUrl && posts[k].visualUrl.indexOf("data:") === 0) {
      posts[k].visualUrl = uploadBase64ToDrive(posts[k].visualUrl, (posts[k].id || "post") + ".png");
    }
  }
  
  var headers = [
    "ID", "Brand", "Title", "Platform", "Scheduled Date", "Scheduled Time",
    "Status", "Assignee", "Reminder Email", "Visual URL", "Caption", "Updated At"
  ];
  
  TAB_CONFIGS.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
    }
    
    // Clear previous contents (preserving sheet structure)
    sheet.clearContents();
    
    if (cfg.isTeam) {
      // Team Roster Tab
      var teamHeaders = ["ID", "Name", "Role", "Email", "Initials"];
      var teamRows = [teamHeaders];
      
      for (var j = 0; j < teamMembers.length; j++) {
        var tm = teamMembers[j];
        teamRows.push([
          tm.id || "",
          tm.name || "",
          tm.role || "",
          tm.email || "",
          tm.avatarInitials || ""
        ]);
      }
      
      sheet.getRange(1, 1, teamRows.length, teamHeaders.length).setValues(teamRows);
      sheet.getRange(1, 1, 1, teamHeaders.length)
        .setFontWeight("bold")
        .setBackground(cfg.color)
        .setFontColor(cfg.fontColor);
    } else {
      // Posts Tab (Master or Brand Specific)
      var filtered = posts;
      if (cfg.brandId) {
        filtered = posts.filter(function(p) { return p.brandId === cfg.brandId; });
      }
      
      var rows = [headers];
      for (var i = 0; i < filtered.length; i++) {
        var p = filtered[i];
        rows.push([
          p.id || "",
          p.brandId || "",
          p.title || "",
          p.platform || "",
          p.scheduledDate || "Backlog Idea",
          p.scheduledTime || "--:--",
          p.status || "",
          (p.assignees && p.assignees.length) ? p.assignees.join(", ") : "Unassigned",
          p.reminderEmail || "",
          p.visualUrl || "",
          p.caption || "",
          new Date().toISOString()
        ]);
      }
      
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground(cfg.color)
        .setFontColor(cfg.fontColor);
    }
  });
  
  // Remove default "Sheet1" if it exists alongside created tabs
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch(e){}
  }
  
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      message: posts.length + " posts atomically synchronized across 7 tabs in Google Sheets",
      spreadsheetUrl: ss.getUrl()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles Sending Real Email Reminders via Google Apps Script MailApp / GmailApp
 */
function handleSendEmailReminder(data) {
  var post = data.post || {};
  var recipient = data.recipientEmail || post.reminderEmail;
  
  if (!recipient) {
    throw new Error("Missing recipient email address.");
  }
  
  var title = post.title || "Instagram Post Reminder";
  var brand = (post.brandId || "Pharmacozyme").toUpperCase();
  var dateStr = post.scheduledDate || new Date().toISOString().split("T")[0];
  var timeStr = post.scheduledTime || "10:00";
  var platform = (post.platform || "Instagram").toUpperCase();
  var caption = post.caption || "No caption provided.";
  var assignee = (post.assignees && post.assignees.length) ? post.assignees.join(", ") : "Team Member";
  var visualUrl = post.visualUrl || "";
  
  var subject = "⏰ [Pharmacozyme Reminder] Time to post on " + platform + ": \\"" + title + "\\"";
  
  var htmlBody = "" +
    "<div style='font-family: \\"Segoe UI\\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #bfcab4; border-radius: 8px; overflow: hidden; background: #faf9f5;'>" +
      "<div style='background: #296c00; padding: 20px; text-align: center; color: white;'>" +
        "<h1 style='margin: 0; font-size: 20px; font-weight: bold;'>Pharmacozyme Brand-Ops Studio</h1>" +
        "<p style='margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;'>Instagram Posting Cue Reminder</p>" +
      "</div>" +
      "<div style='padding: 24px; color: #1b1c1a;'>" +
        "<p style='font-size: 14px; margin-top: 0;'>Hello <strong>" + assignee + "</strong>,</p>" +
        "<p style='font-size: 13px; color: #404a39;'>This is your cue reminder to post manually on <strong>" + platform + "</strong> for <strong>" + brand + "</strong>.</p>" +
        "<div style='background: white; border: 1px solid #bfcab4; padding: 16px; border-radius: 6px; margin: 16px 0;'>" +
          "<h2 style='margin: 0 0 8px 0; font-size: 16px; color: #296c00;'>" + title + "</h2>" +
          "<p style='font-size: 12px; color: #707a67; margin: 0 0 12px 0;'>📅 <strong>Date:</strong> " + dateStr + " at " + timeStr + "</p>" +
          "<div style='background: #faf9f5; border: 1px solid #bfcab4; border-radius: 4px; padding: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; margin-bottom: 12px;'>" + caption + "</div>" +
          (visualUrl ? "<p style='margin: 0; font-size: 12px;'><a href='" + visualUrl + "' target='_blank' style='color: #296c00; font-weight: bold;'>🖼️ Open Visual Asset / Image</a></p>" : "") +
        "</div>" +
        "<p style='font-size: 12px; color: #707a67; margin-bottom: 0;'>We post directly on Instagram, so copy the caption above and upload your image to publish!</p>" +
      "</div>" +
      "<div style='background: #efeeea; padding: 12px 24px; font-size: 11px; color: #707a67; border-top: 1px solid #bfcab4; text-align: center;'>" +
        "Pharmacozyme Brand Operations Studio • Automated Cue System" +
      "</div>" +
    "</div>";
  
  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
  } catch (mErr) {
    try {
      GmailApp.sendEmail(recipient, subject, "", { htmlBody: htmlBody });
    } catch (gErr) {
      throw new Error("Authorization Required: Please open Google Apps Script editor, run function 'handleSendEmailReminder', click 'Review Permissions' -> 'Allow', and re-deploy your Web App.");
    }
  }
  
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      message: "Reminder email sent successfully to " + recipient,
      recipient: recipient,
      title: title
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Reads today's due, unsent, reminder-enabled posts straight from Supabase and
 * emails each assignee. This is what actually runs on a timer (installed by
 * handleInstallReminderTrigger below) instead of relying on someone clicking Send.
 */
function sendDueReminders() {
  if (!SUPABASE_URL || SUPABASE_URL.indexOf("YOUR_SUPABASE") === 0) {
    Logger.log("sendDueReminders: SUPABASE_URL / SUPABASE_ANON_KEY not configured yet - skipping.");
    return;
  }

  // Pinned to a zone independent of the project's timezone setting (which
  // Session.getScriptTimeZone() follows and which can drift). Override per
  // deployment by setting a REMINDER_TIMEZONE script property
  // (Project Settings -> Script Properties); defaults to Asia/Karachi.
  var TIMEZONE = PropertiesService.getScriptProperties().getProperty("REMINDER_TIMEZONE") || "Asia/Karachi";
  var today = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  var nowStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");

  var RPC_SECRET = reminderRpcSecret();
  if (!RPC_SECRET) {
    Logger.log("sendDueReminders: REMINDER_RPC_SECRET script property is not set -- see migration 0018. Skipping.");
    return;
  }

  // p_as_of_date uses lte (not eq) so a reminder that was due while this
  // trigger happened to be down still goes out on the next run, instead of
  // being silently skipped forever. Goes through the get_due_reminders RPC
  // (not a raw table select) because posts RLS only allows the
  // authenticated role -- this script has no Supabase Auth session, only
  // the anon key, so a raw select would always come back empty. The RPC is
  // SECURITY DEFINER and now also requires a shared secret so a leaked anon
  // key alone can't enumerate reminders -- see migration 0018.
  var res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/rpc/get_due_reminders", {
    method: "post",
    headers: supabaseHeaders(),
    payload: JSON.stringify({ p_as_of_date: today, p_secret: RPC_SECRET }),
    muteHttpExceptions: true
  });

  var posts;
  try {
    posts = JSON.parse(res.getContentText());
  } catch (parseErr) {
    Logger.log("sendDueReminders: could not parse Supabase response: " + res.getContentText());
    return;
  }
  if (!posts || !posts.length) {
    Logger.log("sendDueReminders: nothing due as of " + nowStr);
    return;
  }

  posts.forEach(function (row) {
    var recipient = row.reminder_email && row.reminder_email.trim();
    if (!recipient) {
      // No usable address -- mark it sent anyway so get_due_reminders stops
      // handing this same row back on every run forever (the old code just
      // returned, leaving reminder_sent_at null and the row permanently due).
      Logger.log("sendDueReminders: post " + row.id + " has no reminder email -- marking sent to stop retry loop.");
      markReminderSent(row.id);
      return;
    }

    // Compare "yyyy-MM-dd HH:mm" strings lexicographically — valid as long as
    // scheduled_time is zero-padded 24h (the app always saves it that way).
    // No time set on the post means "any time today", so it sends as soon as
    // the date arrives, matching the old daily-batch behavior for that case.
    var timePart = row.scheduled_time && row.scheduled_time.length >= 4 ? row.scheduled_time : "00:00";
    var dueStr = row.scheduled_date + " " + timePart;
    if (dueStr > nowStr) return; // scheduled later today — check again next run

    try {
      handleSendEmailReminder({
        recipientEmail: recipient,
        post: {
          title: row.title,
          brandId: row.brand_id,
          scheduledDate: row.scheduled_date,
          scheduledTime: row.scheduled_time,
          platform: row.platform,
          caption: row.caption,
          assignees: row.assignees,
          visualUrl: row.visual_url
        }
      });
      markReminderSent(row.id);
    } catch (err) {
      Logger.log("sendDueReminders: failed for post " + row.id + ": " + err.toString());
    }
  });
}

/** Standard headers for calling the Supabase REST API as the anon role. */
function supabaseHeaders() {
  return {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
  };
}

/**
 * Shared secret for the reminder RPCs (migration 0018). Must equal the value
 * of private.app_secrets.reminder_rpc_secret in the database. Set it as a
 * REMINDER_RPC_SECRET script property (Project Settings -> Script Properties).
 */
function reminderRpcSecret() {
  return PropertiesService.getScriptProperties().getProperty("REMINDER_RPC_SECRET") || "";
}

/** Stamp reminder_sent_at so this post is never emailed twice (via RPC -- see sendDueReminders). */
function markReminderSent(postId) {
  UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/rpc/mark_reminder_sent", {
    method: "post",
    headers: supabaseHeaders(),
    payload: JSON.stringify({ p_post_id: postId, p_secret: reminderRpcSecret() }),
    muteHttpExceptions: true
  });
}

/** True if a daily sendDueReminders trigger is already installed. */
function isReminderTriggerInstalled() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendDueReminders") return true;
  }
  return false;
}

/**
 * Installs (or re-installs) a trigger that runs sendDueReminders() every 15
 * minutes, so a post's own scheduled time (not just one fixed daily hour)
 * decides when its reminder actually goes out — sendDueReminders itself skips
 * anything not due yet. Called from the app's Integrations tab via the
 * "installReminderTrigger" action. Removes any existing trigger for the same
 * function first, so clicking the button twice doesn't create duplicates that
 * would double-send.
 */
function handleInstallReminderTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "sendDueReminders") {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    // Every 5 minutes so reminders go out close to each post's own
    // scheduled_time — 1/5/10/15/30 are the only intervals Apps Script
    // supports here; 5 is the tightest that isn't wasteful. Minute-based
    // triggers don't need .inTimezone(); the due-time comparison inside
    // sendDueReminders is what's pinned to Asia/Karachi.
    ScriptApp.newTrigger("sendDueReminders").timeBased().everyMinutes(5).create();

    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        message: "Reminder trigger installed - sendDueReminders() now runs every 5 minutes and sends each post's reminder at its own scheduled time.",
        installed: true
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("handleInstallReminderTrigger failed: " + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        error: "Authorization Required: open the Apps Script editor, run function 'handleInstallReminderTrigger' once, click 'Review Permissions' -> 'Allow', and try again. (" + err.toString() + ")"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
