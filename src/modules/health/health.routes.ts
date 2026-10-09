import { Router } from "express";

/**
 * GET /api/v1/health — liveness/readiness для мониторинга.
 * Если передан checkDatabase, отвечает 503 при недоступности БД.
 */
export function healthRoutes(checkDatabase?: () => Promise<boolean>): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    let database: "up" | "down" | "unchecked" = "unchecked";
    if (checkDatabase) {
      database = (await checkDatabase()) ? "up" : "down";
    }

    const healthy = database !== "down";
    res.status(healthy ? 200 : 503).json({
      data: {
        status: healthy ? "ok" : "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database,
      },
    });
  });

  return router;
}
