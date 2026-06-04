/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to data store
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.json");

// Ensure data directory and database file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DB {
  users: Record<string, {
    username: string;
    nickname: string;
    passwordHash: string;
    gender: 'male' | 'female';
    publicKeyJwk: any;
    privateKeyBackup?: {
      ciphertext: string;
      iv: string;
    };
    createdAt: string;
  }>;
  worldMessages: Array<{
    id: string;
    sender: string;
    nickname: string;
    gender: 'male' | 'female';
    text: string;
    timestamp: string;
  }>;
  directMessages: Array<{
    id: string;
    sender: string;
    recipient: string;
    ciphertext: string;
    iv: string;
    encryptedKeyForRecipient: string;
    encryptedKeyForSender: string;
    timestamp: string;
  }>;
}

const defaultDB: DB = {
  users: {},
  worldMessages: [],
  directMessages: [],
};

// Safe read / write database
function readDB(): DB {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, returning default:", err);
    return defaultDB;
  }
}

function writeDB(db: DB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Error writing to database file:", err);
  }
}

// Simple helper SHA-256 password hasher
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Helper to authenticate user using authorization header
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No authorization token present." });
  }

  const token = authHeader.split(" ")[1];
  try {
    // Decoding token. For our lightweight server, token will be a base64 encoded username:timestamp
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, expiry] = decoded.split(":");
    
    // Check if token expired (e.g. 7 days validity)
    if (Date.now() > parseInt(expiry, 10)) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    const db = readDB();
    const user = db.users[username];
    if (!user) {
      return res.status(401).json({ error: "Authorized user does not exist." });
    }

    // Attach requester username
    (req as any).username = username;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token structure." });
  }
}

// API REST ENDPOINTS

// 1. REGISTER
app.post("/api/auth/register", (req, res) => {
  const { username, password, nickname, gender, publicKeyJwk, privateKeyBackup } = req.body;

  if (!username || !password || !nickname || !gender || !publicKeyJwk || !privateKeyBackup) {
    return res.status(400).json({ error: "Please fill in all registration fields, including E2EE key payload." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanNickname = nickname.trim();

  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({ error: "Username must be between 3 and 20 characters." });
  }

  if (cleanNickname.length < 2 || cleanNickname.length > 20) {
    return res.status(400).json({ error: "Nickname must be between 2 and 20 characters." });
  }

  if (gender !== 'male' && gender !== 'female') {
    return res.status(400).json({ error: "Invalid gender selection." });
  }

  const db = readDB();

  if (db.users[cleanUsername]) {
    return res.status(400).json({ error: "Username is already taken by another user." });
  }

  // Create new user
  const passwordHash = hashPassword(password);
  db.users[cleanUsername] = {
    username: cleanUsername,
    nickname: cleanNickname,
    passwordHash,
    gender,
    publicKeyJwk,
    privateKeyBackup,
    createdAt: new Date().toISOString(),
  };

  writeDB(db);

  // Expiry in 7 days
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = Buffer.from(`${cleanUsername}:${expiry}`).toString("base64");

  res.status(201).json({
    token,
    user: {
      username: cleanUsername,
      nickname: cleanNickname,
      gender,
      privateKeyBackup,
    }
  });
});

// 2. LOGIN
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const db = readDB();
  const user = db.users[cleanUsername];

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  // Expiry in 7 days
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = Buffer.from(`${cleanUsername}:${expiry}`).toString("base64");

  res.status(200).json({
    token,
    user: {
      username: user.username,
      nickname: user.nickname,
      gender: user.gender,
      privateKeyBackup: user.privateKeyBackup,
    }
  });
});

// 3. GET CURRENT PROFILE
app.get("/api/auth/me", authenticate, (req, res) => {
  const username = (req as any).username;
  const db = readDB();
  const user = db.users[username];

  if (!user) {
    return res.status(404).json({ error: "Profile not found." });
  }

  res.json({
    user: {
      username: user.username,
      nickname: user.nickname,
      gender: user.gender,
      privateKeyBackup: user.privateKeyBackup,
    }
  });
});

// 4. GET ALL REGISTERED USERS (with public keys for DM initiation)
app.get("/api/users", authenticate, (req, res) => {
  const db = readDB();
  const userList = Object.values(db.users).map((u) => ({
    username: u.username,
    nickname: u.nickname,
    gender: u.gender,
    publicKeyJwk: u.publicKeyJwk,
    createdAt: u.createdAt,
  }));

  res.json(userList);
});

// 5. WORLD CHAT - FETCH MESSAGES
app.get("/api/messages/world", authenticate, (req, res) => {
  const db = readDB();
  const since = req.query.since as string;

  let messages = db.worldMessages;
  if (since) {
    const sinceDate = new Date(since).getTime();
    messages = messages.filter((m) => new Date(m.timestamp).getTime() > sinceDate);
  }

  res.json(messages);
});

// 6. WORLD CHAT - POST MESSAGE
app.post("/api/messages/world", authenticate, (req, res) => {
  const senderUsername = (req as any).username;
  const { text, photo, audio } = req.body;

  if (!text && !photo && !audio) {
    return res.status(400).json({ error: "Message content, photo, or audio cannot be empty." });
  }

  const db = readDB();
  const senderUser = db.users[senderUsername];

  const newMessage = {
    id: crypto.randomUUID(),
    sender: senderUsername,
    nickname: senderUser.nickname,
    gender: senderUser.gender,
    text: text || "",
    photo: photo || null,
    audio: audio || null,
    timestamp: new Date().toISOString(),
  };

  db.worldMessages.push(newMessage);
  // Keep history size reasonable (e.g. max 500 messages)
  if (db.worldMessages.length > 500) {
    db.worldMessages.shift();
  }

  writeDB(db);
  res.status(201).json(newMessage);
});

// 7. DIRECT MESSAGES - FETCH SECURE DMs (Requires E2EE keys on client)
app.get("/api/messages/direct", authenticate, (req, res) => {
  const self = (req as any).username;
  const db = readDB();
  const { partner, since } = req.query;

  if (!partner) {
    return res.status(400).json({ error: "Partner username is required." });
  }

  const partnerUsername = (partner as string).trim().toLowerCase();

  // Filter messages between self and partner
  let messages = db.directMessages.filter(
    (m) =>
      (m.sender === self && m.recipient === partnerUsername) ||
      (m.sender === partnerUsername && m.recipient === self)
  );

  if (since) {
    const sinceDate = new Date(since as string).getTime();
    messages = messages.filter((m) => new Date(m.timestamp).getTime() > sinceDate);
  }

  // Include sender & recipient profiles
  const messagesWithProfiles = messages.map((m) => {
    const senderUser = db.users[m.sender];
    const recipientUser = db.users[m.recipient];

    return {
      id: m.id,
      sender: m.sender,
      senderNickname: senderUser ? senderUser.nickname : "Unknown",
      senderGender: senderUser ? senderUser.gender : "male",
      recipient: m.recipient,
      recipientNickname: recipientUser ? recipientUser.nickname : "Unknown",
      recipientGender: recipientUser ? recipientUser.gender : "male",
      ciphertext: m.ciphertext,
      iv: m.iv,
      encryptedKeyForRecipient: m.encryptedKeyForRecipient,
      encryptedKeyForSender: m.encryptedKeyForSender,
      timestamp: m.timestamp,
    };
  });

  res.json(messagesWithProfiles);
});

// 8. DIRECT MESSAGES - POST E2EE MESSAGE
app.post("/api/messages/direct", authenticate, (req, res) => {
  const senderUsername = (req as any).username;
  const { recipient, ciphertext, iv, encryptedKeyForRecipient, encryptedKeyForSender } = req.body;

  if (!recipient || !ciphertext || !iv || !encryptedKeyForRecipient || !encryptedKeyForSender) {
    return res.status(400).json({ error: "Missing required E2EE field mappings." });
  }

  const recipientUsername = recipient.trim().toLowerCase();
  const db = readDB();

  if (!db.users[recipientUsername]) {
    return res.status(404).json({ error: "Recipient user not found." });
  }

  const newDirectMsg = {
    id: crypto.randomUUID(),
    sender: senderUsername,
    recipient: recipientUsername,
    ciphertext,
    iv,
    encryptedKeyForRecipient,
    encryptedKeyForSender,
    timestamp: new Date().toISOString(),
  };

  db.directMessages.push(newDirectMsg);
  // Keep direct history size reasonable (e.g. max 1000)
  if (db.directMessages.length > 2000) {
    db.directMessages.shift();
  }

  writeDB(db);

  // Return formatted message
  const senderUser = db.users[senderUsername];
  const recipientUser = db.users[recipientUsername];

  res.status(201).json({
    id: newDirectMsg.id,
    sender: newDirectMsg.sender,
    senderNickname: senderUser.nickname,
    senderGender: senderUser.gender,
    recipient: newDirectMsg.recipient,
    recipientNickname: recipientUser.nickname,
    recipientGender: recipientUser.gender,
    ciphertext: newDirectMsg.ciphertext,
    iv: newDirectMsg.iv,
    encryptedKeyForRecipient: newDirectMsg.encryptedKeyForRecipient,
    encryptedKeyForSender: newDirectMsg.encryptedKeyForSender,
    timestamp: newDirectMsg.timestamp,
  });
});

// 9. CHECK USERNAME AVAILABILITY
app.get("/api/auth/check-username", (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "Username parameter is required." });
  }

  const cleanUsername = (username as string).trim().toLowerCase();
  const db = readDB();
  const taken = !!db.users[cleanUsername];
  res.json({ taken });
});

// 10. UPDATE USER SETTINGS
app.post("/api/auth/update-settings", authenticate, (req, res) => {
  const username = (req as any).username;
  const { nickname, password, gender, privateKeyBackup } = req.body;

  const db = readDB();
  const user = db.users[username];
  if (!user) {
    return res.status(404).json({ error: "Authenticated node user not found." });
  }

  if (nickname) {
    const cleanNickname = nickname.trim();
    if (cleanNickname.length < 2 || cleanNickname.length > 20) {
      return res.status(400).json({ error: "Nickname must be between 2 and 20 characters." });
    }
    user.nickname = cleanNickname;
  }

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    user.passwordHash = hashPassword(password);
  }

  if (gender) {
    if (gender !== 'male' && gender !== 'female') {
      return res.status(400).json({ error: "Invalid gender value option." });
    }
    user.gender = gender;
  }

  if (privateKeyBackup) {
    user.privateKeyBackup = privateKeyBackup;
  }

  writeDB(db);

  // Return new 7 days session token with the updated settings
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = Buffer.from(`${username}:${expiry}`).toString("base64");

  res.json({
    message: "Settings updated successfully.",
    token,
    user: {
      username: user.username,
      nickname: user.nickname,
      gender: user.gender,
      privateKeyBackup: user.privateKeyBackup,
    }
  });
});

// BOOT SERVER WITH VITE MIDDLEWARE

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
