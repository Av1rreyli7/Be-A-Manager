/** "Refresh rosters": re-runs the data pipeline (dev/local only: it writes data/*.json on disk). */
import { execFile } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production") return Response.json({ ok: false, error: "Refreshing data is only available when running locally (npm run dev)." }, { status: 403 });
  const cwd = process.cwd();
  const tsx = path.join(cwd, "node_modules", ".bin", "tsx");
  return new Promise<Response>((resolve) => {
    execFile(tsx, ["scripts/fetch-data.ts", "--refresh"], { cwd, timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const tail = (stdout + stderr).split("\n").slice(-8).join("\n");
      if (err) resolve(Response.json({ ok: false, error: `${err.message}\n${tail}` }, { status: 500 }));
      else resolve(Response.json({ ok: true, output: tail }));
    });
  });
}
