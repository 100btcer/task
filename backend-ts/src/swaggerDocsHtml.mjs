/**
 * Single-page Swagger UI. Assets are served from `swagger-ui-dist` (same origin, no CDN).
 * Bundle + standalone preset are required for Swagger UI 5 `StandaloneLayout`.
 * OpenAPI spec uses absolute path `/api/openapi.json` (same origin) so it works regardless of whether this page is
 * served at `/api/docs`, `/api/docs/`, or behind a proxy — relative `../openapi.json` wrongly becomes `/openapi.json`
 * when the docs URL path is not under `/api/`.
 *
 * @param {string} assetsBase URL prefix where `express.static(swagger-ui-dist)` is mounted (no trailing slash).
 */
export function getSwaggerDocsHtml(assetsBase) {
  const base = assetsBase.replace(/\/$/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tasks API — Swagger UI</title>
  <link rel="stylesheet" href="${base}/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: inherit; }
    body { margin: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${base}/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="${base}/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function () {
      var specUrl = new URL('/api/openapi.json', window.location.origin).href;
      window.ui = SwaggerUIBundle({
        url: specUrl,
        dom_id: '#swagger-ui',
        deepLinking: true,
        tryItOutEnabled: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    };
  </script>
</body>
</html>`;
}
