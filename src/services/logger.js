const useragent = require("useragent");
const ActivityLog = require("../models/logEntry");

// Logger Service
class LoggerService {
  
  // Middleware to auto-log each request with minimal data
  static expressRequestLogger() {
    return async (req, res, next) => {
      try {
        // Don't log static assets or certain paths if desired
        if (req.path.startsWith("/static") || req.path.startsWith("/favicon.ico")) {
          return next();
        }

        // Build minimal auto-log entry for request start
        const agent = useragent.parse(req.headers["user-agent"] || "");
        const deviceType = /mobile/i.test(agent.device.toString())
          ? "mobile"
          : /tablet/i.test(agent.device.toString())
          ? "tablet"
          : /bot/i.test(agent.device.toString())
          ? "bot"
          : "desktop";

        // Create pending log entry for the request
        const logEntry = new ActivityLog({
          userId: req.user?._id,
          role: req.user?.role || "user",
          sessionId: req.sessionID,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          endpoint: req.originalUrl,
          httpMethod: req.method,
          device: {
            os: agent.os.toString(),
            browser: agent.toAgent(),
            deviceType,
          },
          operation: "read",
          action: "REQUEST_START",
          description: `Incoming request for ${req.originalUrl}`,
          status: "pending"
        });

        // Save log entry and attach to req for later update
        const savedLog = await logEntry.save();
        req._activityLogId = savedLog._id;

        // After response finishes, update log with status success or failure
        res.on("finish", async () => {
          try {
            const log = await ActivityLog.findById(req._activityLogId);
            if (!log) return;
            log.status = res.statusCode >= 400 ? "failure" : "success";
            log.errorCode = res.statusCode >= 400 ? String(res.statusCode) : null;
            log.errorMessage = res.statusCode >= 400 ? res.statusMessage : null;
            await log.save();
          } catch (err) {
            // Fail silently or use another error handling/logging mechanism
          }
        });

        next();
      } catch (err) {
        // Fail silently and continue request processing
        next();
      }
    };
  }

  // Manual logging method for custom actions
  static async logActivity(req, {
    operation,
    action,
    description,
    entity,
    entityId,
    subEntity,
    subEntityId,
    changes,
    metadata,
    status = "success",
    errorCode = null,
    errorMessage = null,
    sensitive = false,
    retentionPolicy = "1y",
  }) {
    const agent = useragent.parse(req.headers["user-agent"] || "");
    const deviceType = /mobile/i.test(agent.device.toString())
      ? "mobile"
      : /tablet/i.test(agent.device.toString())
      ? "tablet"
      : /bot/i.test(agent.device.toString())
      ? "bot"
      : "desktop";

    const logEntry = new ActivityLog({
      userId: req.user?._id,
      role: req.user?.role || "user",
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      endpoint: req.originalUrl,
      httpMethod: req.method,
      device: {
        os: agent.os.toString(),
        browser: agent.toAgent(),
        deviceType,
      },
      operation,
      action,
      description,
      entity,
      entityId,
      subEntity,
      subEntityId,
      changes,
      metadata,
      status,
      errorCode,
      errorMessage,
      sensitive,
      retentionPolicy,
    });

    return await logEntry.save();
  }
}

module.exports = LoggerService;
