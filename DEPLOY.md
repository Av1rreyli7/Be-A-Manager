# Putting Be-A-Manager online with Render (free plan)

This guide is written for a first timer. You need two free accounts: GitHub and Render.

## 1. Put the code on GitHub

1. Open the `upload` folder that sits inside `site`. It holds exactly the files that belong on GitHub. Nothing in it is junk, and nothing is missing.
2. On github.com click **New repository**. Give it a name, for example `be-a-manager`. Leave every other box alone and click **Create repository**.
3. On the page of the new empty repository click **uploading an existing file**.
4. Open the `upload` folder on your computer, select everything inside it (not the folder itself) and drag it into the browser window. Wait until all files are listed.
5. Click **Commit changes**.

Check: the repository front page must show `package.json`, `server.js`, and the folders `floodlights`, `src`, `public`, `data` right at the top level. If you see a single folder called `upload` instead, you dragged the folder and not what is inside it. Delete the repository and do step 4 again.

Tip: GitHub in the browser takes at most 100 files per drag. This project has more than that, so drag it in a few goes (for example `src` first, then `floodlights`, then the rest), or use the GitHub Desktop app, which has no such limit.

## 2. Create the web service on Render

1. On render.com click **New** and then **Web Service**.
2. Connect your GitHub account if Render asks, then pick the repository from step 1.
3. Fill in the form with exactly these values:

| Setting | Value |
| --- | --- |
| Language | `Node` |
| Branch | `main` |
| Root Directory | leave it empty |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance Type | `Free` |

4. Open **Advanced** (or the **Environment** section) and add these environment variables:

| Key | Value | Why |
| --- | --- | --- |
| `NODE_VERSION` | `22` | Next.js 16 needs a modern Node. The repo also has a `.node-version` file that says the same thing. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Optional. Just keeps the build log quiet. |

5. Still under **Advanced**, set **Health Check Path** to `/healthz`.
6. Click **Create Web Service** (it may say **Deploy Web Service**).

The first build takes a few minutes. When the log says `Be-A-Manager running on port ...` the site is live at the address Render shows at the top of the page (something like `https://be-a-manager.onrender.com`).

You do not set a port anywhere. Render hands the server a port by itself and `server.js` uses it.

Shortcut: the repository includes a `render.yaml` file. If you pick **New > Blueprint** instead of **Web Service**, Render reads all of the settings above from that file and you only have to click **Apply**.

## 3. If you are replacing the old Floodlights service

If Floodlights already runs on Render from its old repository, the simplest path is a brand new service as described above. If you would rather keep the old address, open the old service and change these in its **Settings**:

- the repository (or push this code to the old repository),
- **Build Command**: from `npm install` to `npm install && npm run build`,
- **Start Command**: stays `npm start`,
- add the `NODE_VERSION` = `22` environment variable,
- **Health Check Path**: `/healthz`.

Then click **Manual Deploy > Deploy latest commit**.

One thing changes for your friends: Floodlights used to be the front page. It now lives at `/floodlights/`. The front page is the new landing page with both games.

## 4. Things that are normal on the free plan

- **The site sleeps.** After about 15 minutes with no visitors Render stops the server. The next visit wakes it, which takes up to a minute. Keep a tab open while you play and it stays awake.
- **Floodlights rooms reset when the server restarts.** Saves live in a file called `games.json` on the server, and the free plan wipes it on every restart, sleep or new deploy. That is expected. A normal play session is safe as long as somebody keeps the tab open.
- **Front Office saves are not affected.** They live in each player's own browser.
- **Memory.** The free instance has 512 MB. The server uses about 170 MB when idle, so there is plenty of room.
- **Fonts for Front Office are fetched while building.** The build downloads two Google fonts for Front Office (the same as before the merge). Render has internet during the build, so this just works.

## 5. If something goes wrong

- **Build fails with "next: not found" or a missing module.** The Build Command is wrong. It must be `npm install && npm run build`.
- **Build fails with a Node version message.** The `NODE_VERSION` variable is missing. Add it with the value `22` and deploy again.
- **Build stops with an out of memory message.** Click **Manual Deploy > Clear build cache & deploy** and try once more. Builds run on Render's build machines, not on the small 512 MB instance, so this should be rare.
- **The page loads but Floodlights says "Server error".** Open `/healthz` on your site. If it does not answer `{"ok":true}`, look at the **Logs** tab on Render for the real error.
- **You changed the code and want to update the site.** Upload the changed files to GitHub the same way. Render sees the new commit and deploys again by itself.

## 6. Check the live site

Once it is up, try these in a normal browser:

1. Open the front page. The Be-A-Manager headline rises in, the labels decode, and the 3D stadium fades in behind it.
2. Click GAME NIGHT in the list on the left. The copy, the labels and the background all change together.
3. Click ENTER FLOODLIGHTS. Create a game, then join it from a second device or a private window with the 4 letter code.
4. In Floodlights pick a club, start the world, open the Matches tab and click Play this match. Play a little in 3D, then start another match week in Classic.
5. Go back to the front page and click ENTER GAME NIGHT. Open Front Office, start a league, and also open Hardwood Legends.
