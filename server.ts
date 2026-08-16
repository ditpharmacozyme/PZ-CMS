import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Vercel injects project env vars directly for its serverless functions, but
// local `npm run dev` needs this -- default dotenv only reads `.env`, and
// this repo only has `.env.local`/`.env.example`.
dotenv.config({ path: ".env.local" });

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  // JSON Body Parser middleware for handling large base64 upload payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      server: "Pharmacozyme Express Node Server",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      appsScriptConfigured: Boolean(process.env.APPS_SCRIPT_URL)
    });
  });

  // Local server file upload endpoint
  app.post("/api/upload", (req, res) => {
    try {
      const { fileName, base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ status: "error", message: "Missing base64Data in payload" });
      }

      // Return data URL as uploaded visual URL
      const dataUrl = base64Data.startsWith("data:")
        ? base64Data
        : `data:${mimeType || "image/png"};base64,${base64Data}`;

      res.json({
        status: "success",
        message: "File uploaded successfully to Express Node Server",
        fileName: fileName || "upload.png",
        url: dataUrl,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Owner-only: creates a real Supabase Auth account (invite email) + the
  // team_members row. Hand-mirrors api/team/create-member.ts for local dev
  // parity, same as the other routes in this file.
  app.post("/api/team/create-member", async (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return res.status(500).json({ status: "error", code: "SERVER_NOT_CONFIGURED", message: "Server is missing required Supabase environment variables." });
    }

    const verifyClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });

    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
      if (!token) {
        return res.status(401).json({ status: "error", code: "UNAUTHENTICATED", message: "Missing Authorization header." });
      }

      const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return res.status(401).json({ status: "error", code: "UNAUTHENTICATED", message: "Invalid or expired session." });
      }

      const { data: callerRow, error: callerError } = await adminClient
        .from("team_members")
        .select("user_role")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (callerError) {
        return res.status(500).json({ status: "error", code: "CALLER_LOOKUP_FAILED", message: callerError.message });
      }
      if (!callerRow || callerRow.user_role !== "Admin") {
        return res.status(403).json({ status: "error", code: "FORBIDDEN", message: "Only an Admin can create new team member accounts." });
      }

      const { name, email, role, color } = req.body ?? {};
      if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.trim() || typeof role !== "string" || typeof color !== "string") {
        return res.status(400).json({ status: "error", code: "INVALID_INPUT", message: "Missing or invalid name, email, role, or color." });
      }
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      const { data: existingMember, error: existingMemberError } = await adminClient
        .from("team_members")
        .select("id")
        .ilike("email", trimmedEmail)
        .maybeSingle();
      if (existingMemberError) {
        return res.status(500).json({ status: "error", code: "MEMBER_LOOKUP_FAILED", message: existingMemberError.message });
      }
      if (existingMember) {
        return res.status(409).json({ status: "error", code: "MEMBER_EXISTS", message: "A team member with this email already exists." });
      }

      const redirectTo = `${req.protocol}://${req.get("host")}/`;

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(trimmedEmail, {
        redirectTo,
        data: { name: trimmedName }
      });
      if (inviteError || !inviteData?.user) {
        const alreadyRegistered = inviteError?.message?.toLowerCase().includes("already been registered") || inviteError?.message?.toLowerCase().includes("already registered");
        if (alreadyRegistered) {
          return res.status(409).json({ status: "error", code: "AUTH_EXISTS", message: "This email already has a Supabase Auth account." });
        }
        return res.status(500).json({ status: "error", code: "AUTH_CREATE_FAILED", message: inviteError?.message || "Failed to create the Auth account." });
      }

      const newMemberId = `tm-${Date.now()}`;
      const { error: insertError } = await adminClient.from("team_members").insert({
        id: newMemberId,
        name: trimmedName,
        role,
        user_role: "Editor",
        email: trimmedEmail,
        avatar_initials: getInitials(trimmedName),
        color,
        auth_user_id: inviteData.user.id
      });

      if (insertError) {
        const { error: rollbackError } = await adminClient.auth.admin.deleteUser(inviteData.user.id);
        if (rollbackError) {
          return res.status(500).json({
            status: "error",
            code: "PROFILE_SAVE_FAILED_MANUAL_CLEANUP",
            message: `Account was created but the profile save failed, and rollback also failed. Contact an admin to remove auth user ${inviteData.user.id} (${trimmedEmail}) manually.`,
            orphanedAuthUserId: inviteData.user.id,
            orphanedEmail: trimmedEmail
          });
        }
        return res.status(500).json({ status: "error", code: "PROFILE_SAVE_FAILED_ROLLED_BACK", message: `Failed to save the team member profile (${insertError.message}). No account was left behind -- safe to retry.` });
      }

      return res.status(200).json({
        status: "success",
        teamMember: {
          id: newMemberId,
          name: trimmedName,
          role,
          userRole: "Editor",
          email: trimmedEmail,
          avatarInitials: getInitials(trimmedName),
          color,
          authUserId: inviteData.user.id
        }
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", code: "UNEXPECTED_ERROR", message: err?.message || "Unexpected server error." });
    }
  });

  // Owner-only: revokes a team member's Supabase Auth account and removes
  // their team_members row. Hand-mirrors api/team/remove-member.ts for
  // local dev parity, same as the other routes in this file.
  app.post("/api/team/remove-member", async (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return res.status(500).json({ status: "error", code: "SERVER_NOT_CONFIGURED", message: "Server is missing required Supabase environment variables." });
    }

    const verifyClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });

    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
      if (!token) {
        return res.status(401).json({ status: "error", code: "UNAUTHENTICATED", message: "Missing Authorization header." });
      }

      const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return res.status(401).json({ status: "error", code: "UNAUTHENTICATED", message: "Invalid or expired session." });
      }

      const { data: callerRow, error: callerError } = await adminClient
        .from("team_members")
        .select("user_role")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (callerError) {
        return res.status(500).json({ status: "error", code: "CALLER_LOOKUP_FAILED", message: callerError.message });
      }
      if (!callerRow || callerRow.user_role !== "Admin") {
        return res.status(403).json({ status: "error", code: "FORBIDDEN", message: "Only an Admin can remove team members." });
      }

      const { id } = req.body ?? {};
      if (typeof id !== "string" || !id.trim()) {
        return res.status(400).json({ status: "error", code: "INVALID_INPUT", message: "Missing or invalid id." });
      }

      const { data: targetRow, error: targetError } = await adminClient
        .from("team_members")
        .select("id, user_role, auth_user_id")
        .eq("id", id)
        .maybeSingle();
      if (targetError) {
        return res.status(500).json({ status: "error", code: "MEMBER_LOOKUP_FAILED", message: targetError.message });
      }
      if (!targetRow) {
        return res.status(404).json({ status: "error", code: "MEMBER_NOT_FOUND", message: "No team member with this id." });
      }
      if (targetRow.user_role === "Admin") {
        return res.status(403).json({ status: "error", code: "CANNOT_REMOVE_ADMIN", message: "Admins cannot be removed." });
      }

      if (targetRow.auth_user_id) {
        const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetRow.auth_user_id);
        if (authDeleteError) {
          return res.status(500).json({ status: "error", code: "AUTH_DELETE_FAILED", message: authDeleteError.message });
        }
      }

      const { error: deleteError } = await adminClient.from("team_members").delete().eq("id", id);
      if (deleteError) {
        return res.status(500).json({
          status: "error",
          code: "PROFILE_DELETE_FAILED_MANUAL_CLEANUP",
          message: `The Auth account was revoked, but removing the team_members row failed (${deleteError.message}). Contact an admin to remove team_members id ${id} manually.`,
          orphanedTeamMemberId: id
        });
      }

      return res.status(200).json({ status: "success" });
    } catch (err: any) {
      return res.status(500).json({ status: "error", code: "UNEXPECTED_ERROR", message: err?.message || "Unexpected server error." });
    }
  });

  // Proxy endpoint to Google Apps Script Web App (Bypasses CORS restrictions).
  // Hand-mirrors api/appscript/proxy.ts for local dev parity -- see that
  // file for why auth + the script.google.com allowlist are required.
  const ALLOWED_SCRIPT_URL_PREFIX = "https://script.google.com/macros/";
  app.post("/api/appscript/proxy", async (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return res.status(500).json({ status: "error", message: "Server is missing required Supabase environment variables." });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) {
      return res.status(401).json({ status: "error", message: "Missing Authorization header." });
    }
    const verifyClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ status: "error", message: "Invalid or expired session." });
    }

    try {
      const { scriptUrl: clientScriptUrl, payload } = req.body ?? {};
      const scriptUrl = clientScriptUrl || process.env.APPS_SCRIPT_URL;
      if (!scriptUrl) {
        return res.status(400).json({ status: "error", message: "No Google Apps Script URL configured. An Owner needs to set APPS_SCRIPT_URL, or paste one to test in Integrations." });
      }
      if (!scriptUrl.startsWith(ALLOWED_SCRIPT_URL_PREFIX)) {
        return res.status(400).json({ status: "error", message: `scriptUrl must start with ${ALLOWED_SCRIPT_URL_PREFIX}` });
      }

      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload || {}),
        redirect: "follow"
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }

      res.json({
        status: "success",
        proxyStatus: response.status,
        data: responseData
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pharmacozyme Backend Server listening on http://localhost:${PORT}`);
  });
}

startServer();
