const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Starting ClaimGuard Services for Production...");

// Force HOSTNAME to 0.0.0.0 so Render's load balancer can connect
process.env.HOSTNAME = "0.0.0.0";
process.env.NODE_ENV = "production";

// Start mini-services in background
console.log("👉 Starting Mock Claim Portal (port 3005)...");
const mockPortal = spawn("npx", ["tsx", "mini-services/mock-portal/index.ts"], {
  stdio: "inherit",
  env: process.env,
});

console.log("👉 Starting Playwright Automation Service (port 3004)...");
const playwrightSvc = spawn("npx", ["tsx", "mini-services/playwright-service/index.ts"], {
  stdio: "inherit",
  env: process.env,
});

// Start Next.js Standalone Server (listens on PORT set by Render, e.g. 10000)
console.log(`👉 Starting Next.js Server on HOSTNAME=${process.env.HOSTNAME} PORT=${process.env.PORT || 3000}...`);
const nextServer = spawn("node", [path.join(__dirname, ".next/standalone/server.js")], {
  stdio: "inherit",
  env: process.env,
});

nextServer.on("exit", (code) => {
  console.log(`Next.js server exited with code ${code}`);
  process.exit(code || 0);
});

process.on("SIGTERM", () => {
  mockPortal.kill();
  playwrightSvc.kill();
  nextServer.kill();
  process.exit(0);
});
