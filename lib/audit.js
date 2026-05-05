function clientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.socket.remoteAddress || "";
}

function logAudit(db, req, user, action, entityType, entityId = "", metadata = {}) {
  db.prepare(
    `INSERT INTO audit_logs (actor_user_id, actor_username, action, entity_type, entity_id, metadata_json, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user?.id || null,
    user?.username || "",
    action,
    entityType,
    entityId || "",
    JSON.stringify(metadata || {}),
    clientIp(req),
    String(req.headers["user-agent"] || "")
  );
}

module.exports = {
  logAudit
};
