import { Router } from "express";

import { openapiDocument } from "./openapi.js";

const SWAGGER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>rest-api-forge — API docs</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
    />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        dom_id: "#swagger-ui",
      });
    </script>
  </body>
</html>`;

export function openapiRoutes(): Router {
  const router = Router();

  router.get("/openapi.json", (_req, res) => {
    res.json(openapiDocument);
  });

  router.get("/docs", (_req, res) => {
    res.type("text/html").send(SWAGGER_HTML);
  });

  return router;
}
