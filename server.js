// Be-A-Manager combined server. One process, one port, built for the Render free tier.
// Express owns the Floodlights routes (the game page at /floodlights/ and its API at /api/...).
// Next.js serves everything else: the landing page at / and all of Front Office.
const express = require("express");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const nextApp = next({ dev, dir: __dirname });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const server = express();
  server.disable("x-powered-by");
  // a tiny health check that never touches Next, handy for Render and for the boot test
  server.get("/healthz", (req, res) => res.json({ ok: true }));
  // Floodlights first. Anything it does not own falls through to Next.
  server.use(require("./floodlights/server"));
  server.all("*", (req, res) => handle(req, res));
  server.listen(port, () => {
    console.log(`Be-A-Manager running on port ${port} (${dev ? "development" : "production"})`);
  });
}).catch(err => {
  console.error("Could not start the server", err);
  process.exit(1);
});
