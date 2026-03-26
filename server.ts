import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Cache for repository data
  let repoCache: Record<string, any> = {};
  let lastFetch: Record<string, number> = {};
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  // API Route to fetch repository index
  app.get('/api/repo', async (req, res) => {
    const urlsParam = (req.query.urls as string) || 'https://f-droid.org/repo/index-v1.json';
    const repoUrls = urlsParam.split(',').map(u => u.trim()).filter(Boolean);
    
    try {
      const now = Date.now();
      let allApps: any[] = [];
      let mergedRepoInfo: any = { name: 'Merged Repositories', description: 'Apps from multiple repositories' };

      let successCount = 0;

      for (const repoUrl of repoUrls) {
        let repoData;
        try {
          if (repoCache[repoUrl] && (now - lastFetch[repoUrl] < CACHE_DURATION)) {
            repoData = repoCache[repoUrl];
          } else {
            const response = await axios.get(repoUrl, { timeout: 15000 });
            const data = response.data;
            
            let apps: any[] = [];
            
            // Handle index-v2.json (apps is a map)
            if (data.apps && !Array.isArray(data.apps)) {
              apps = Object.entries(data.apps).map(([packageName, app]: [string, any]) => {
                // In v2, icon might be an object { name: "..." }
                let icon = app.icon;
                if (icon && typeof icon === 'object' && icon.name) {
                  icon = icon.name;
                }

                // In v2, screenshots might be in a different place or format
                // For simplicity, we'll try to extract what we can
                return {
                  id: packageName,
                  name: app.name?.['en-US'] || Object.values(app.name || {})[0] || packageName,
                  summary: app.summary?.['en-US'] || Object.values(app.summary || {})[0] || '',
                  description: app.description?.['en-US'] || Object.values(app.description || {})[0] || '',
                  icon: icon,
                  categories: app.categories || [],
                  added: app.added,
                  lastUpdated: app.lastUpdated,
                  versionName: app.versionName,
                  packageName: packageName,
                  apkName: '', // v2 handles packages differently
                  authorName: app.authorName,
                  license: app.license,
                  webSite: app.webSite,
                  sourceCode: app.sourceCode,
                  issueTracker: app.issueTracker,
                  screenshots: [], // v2 screenshots are more complex
                  repoUrl: repoUrl.replace(/\/index-v\d\.json$/, '')
                };
              });
            } 
            // Handle index-v1.json (apps is an array)
            else {
              apps = (data.apps || []).map((app: any) => {
                const appPackages = data.packages ? data.packages[app.packageName] || [] : [];
                const latestPackage = appPackages[0];
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

                return {
                  id: app.packageName,
                  name: name || app.packageName,
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
                  repoUrl: repoUrl.replace(/\/index-v\d\.json$/, '')
                };
              });
            }

            repoData = {
              repo: data.repo || { name: 'Unknown Repo', description: '' },
              apps: apps,
            };
            repoCache[repoUrl] = repoData;
            lastFetch[repoUrl] = now;
          }

          if (repoUrls.length === 1) {
            mergedRepoInfo = repoData.repo;
          }
          allApps = [...allApps, ...repoData.apps];
          successCount++;
        } catch (err) {
          console.error(`Error fetching repo ${repoUrl}:`, err instanceof Error ? err.message : String(err));
        }
      }

      if (successCount === 0 && repoUrls.length > 0) {
        return res.status(500).json({ error: 'Failed to fetch any repository data' });
      }

      // Handle duplicates by keeping the one with the most recent lastUpdated or just the first one
      const uniqueAppsMap = new Map();
      for (const app of allApps) {
        if (!uniqueAppsMap.has(app.packageName)) {
          uniqueAppsMap.set(app.packageName, app);
        } else {
          const existing = uniqueAppsMap.get(app.packageName);
          if (app.lastUpdated > existing.lastUpdated) {
            uniqueAppsMap.set(app.packageName, app);
          }
        }
      }

      res.json({
        repo: mergedRepoInfo,
        apps: Array.from(uniqueAppsMap.values())
      });
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
