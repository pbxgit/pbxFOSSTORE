import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cache for repository data
  let repoCache: Record<string, any> = {};
  let lastFetch: Record<string, number> = {};
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  // API Route to fetch repository index
  app.get('/api/repo', async (req, res) => {
    const repoUrl = (req.query.url as string) || 'https://f-droid.org/repo/index-v1.json';
    
    try {
      const now = Date.now();
      if (repoCache[repoUrl] && (now - lastFetch[repoUrl] < CACHE_DURATION)) {
        return res.json(repoCache[repoUrl]);
      }

      const response = await axios.get(repoUrl);
      
      // Process and simplify the data
      const apps = response.data.apps.map((app: any) => {
        // Find the latest package for this app to get the APK name
        const appPackages = response.data.packages[app.packageName] || [];
        const latestPackage = appPackages[0]; // Usually the first one is the latest in v1 index
        const apkName = latestPackage ? latestPackage.apkName : '';

        let name = app.name;
        let summary = app.summary;
        let description = app.description;
        let icon = app.icon;
        let screenshots: string[] = [];
        let video = '';

        if (app.localized) {
          const loc = app.localized['en-US'] || Object.values(app.localized)[0] as any;
          if (loc) {
            name = loc.name || name;
            summary = loc.summary || summary;
            description = loc.description || description;
            icon = loc.icon || icon;
            if (loc.phoneScreenshots) {
              screenshots = loc.phoneScreenshots.map((s: string) => `${app.packageName}/en-US/phoneScreenshots/${s}`);
            } else if (loc.sevenInchScreenshots) {
              screenshots = loc.sevenInchScreenshots.map((s: string) => `${app.packageName}/en-US/sevenInchScreenshots/${s}`);
            }
            if (loc.video) {
              video = loc.video;
            }
          }
        }

        name = name || app.packageName;

        return {
          id: app.packageName,
          name: name,
          summary: summary,
          description: description,
          icon: icon,
          categories: app.categories || [],
          added: app.added,
          lastUpdated: app.lastUpdated,
          versionName: app.versionName,
          packageName: app.packageName,
          apkName: apkName,
          authorName: app.authorName,
          license: app.license,
          webSite: app.webSite,
          sourceCode: app.sourceCode,
          issueTracker: app.issueTracker,
          changelog: app.changelog,
          donate: app.donate,
          bitcoin: app.bitcoin,
          litecoin: app.litecoin,
          flattrID: app.flattrID,
          liberapayID: app.liberapayID,
          openCollective: app.openCollective,
          screenshots: screenshots,
          video: video,
        };
      });

      repoCache[repoUrl] = {
        repo: response.data.repo,
        apps: apps,
      };
      lastFetch[repoUrl] = now;

      res.json(repoCache[repoUrl]);
    } catch (error) {
      console.error('Error fetching repo:', error);
      res.status(500).json({ error: 'Failed to fetch repository data' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
