const crypto = require("node:crypto");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, salt, expected) {
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function createAuth(db, { adminUsername, adminPassword, resetAdminPassword }) {
  function seedAdmin() {
    const existing = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(adminUsername);
    const { hash, salt } = hashPassword(adminPassword);
    if (!existing) {
      db.prepare("INSERT INTO admin_users (username, password_hash, password_salt) VALUES (?, ?, ?)").run(adminUsername, hash, salt);
      return;
    }
    if (resetAdminPassword) {
      db.prepare("UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hash, salt, existing.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
    }
  }

  function currentUser(token) {
    if (!token) return null;
    return db
      .prepare(
        `SELECT admin_users.id, admin_users.username, sessions.csrf_token AS csrfToken
         FROM sessions
         JOIN admin_users ON admin_users.id = sessions.user_id
         WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`
      )
      .get(token);
  }

  function publicUser(user) {
    if (!user) return null;
    return { id: user.id, username: user.username };
  }

  function findUser(username) {
    return db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username || "");
  }

  function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const csrfToken = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions (token, user_id, expires_at, csrf_token) VALUES (?, ?, datetime('now', '+30 days'), ?)").run(token, userId, csrfToken);
    return { token, csrfToken };
  }

  function deleteSession(token) {
    if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  function cleanupExpiredSessions() {
    db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  }

  return {
    seedAdmin,
    currentUser,
    publicUser,
    findUser,
    createSession,
    deleteSession,
    cleanupExpiredSessions,
    verifyPassword
  };
}

module.exports = {
  createAuth,
  hashPassword,
  verifyPassword
};
