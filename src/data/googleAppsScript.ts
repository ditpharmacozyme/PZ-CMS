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
 * 3. Click "Save project" (Ctrl+S or Cmd+S)
 * 4. IMPORTANT FOR EMAIL REMINDERS:
 *    - Select "doGet" or "handleSendEmailReminder" from the function dropdown at the top of Apps Script editor.
 *    - Click "Run".
 *    - Click "Review permissions" -> select your Google Account -> "Advanced" -> "Go to Pharmacozyme Backend (unsafe)" -> "Allow".
 * 5. Click "Deploy" -> "New deployment"
 * 6. Select type: "Web app"
 * 7. Set Description: "Pharmacozyme CMS Media, Multi-Tab Sheets & Email Backend"
 * 8. Set Execute as: "Me (your account)"
 * 9. Set Who has access: "Anyone" (CRITICAL for receiving uploads and requests)
 * 10. Click "Deploy"
 * 11. Copy the Web App URL (starts with https://script.google.com/macros/s/...) and paste it into your CMS App Settings!
 */

// Global Configuration
const DRIVE_FOLDER_NAME = "Pharmacozyme CMS Uploads";
const SPREADSHEET_NAME = "Pharmacozyme Content Schedule";

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
    } else if (action === "syncAllPosts" || action === "syncPost") {
      return handleSyncMultiTabSheets(data);
    } else if (action === "sendEmailReminder" || action === "sendTestEmail") {
      return handleSendEmailReminder(data);
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
    "Status", "Assignee", "Approved", "Reminder Email", "Visual URL", "Caption", "Updated At"
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
          p.assignee || "Unassigned",
          p.approved ? "YES" : "NO",
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
  var assignee = post.assignee || "Team Member";
  var visualUrl = post.visualUrl || "";
  
  var subject = "⏰ [Pharmacozyme Reminder] Time to post on " + platform + ": \\"" + title + "\\"";
  
  var htmlBody = "" +
    "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #bfcab4; border-radius: 8px; overflow: hidden; background: #faf9f5;'>" +
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
          "<div style='background: #faf9f5; border-left: 3px solid #296c00; padding: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; margin-bottom: 12px;'>" + caption + "</div>" +
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
`;
