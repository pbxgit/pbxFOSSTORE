import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
            
            // Process and simplify the data
            const apps = (response.data.apps || []).map((app: any) => {
              // Find the latest package for this app to get the APK name
              const appPackages = response.data.packages ? response.data.packages[app.packageName] || [] : [];
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
                repoUrl: repoUrl.replace('/index-v1.json', '')
              };
            });

            repoData = {
              repo: response.data.repo || { name: 'Unknown Repo', description: '' },
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

  // AI Recommendations Endpoint
  app.post('/api/recommend', async (req, res) => {
    try {
      const { favorites, allApps } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key not configured' });
      }

      if (!favorites || favorites.length === 0) {
        return res.json({ recommendations: [] });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // We only send a subset of app info to save tokens
      const appCatalog = allApps.map((a: any) => ({ 
        id: a.packageName, 
        name: a.name, 
        summary: a.summary,
        categories: a.categories
      }));

      const prompt = `
        You are an expert app recommender. 
        The user has favorited the following apps: ${favorites.join(', ')}.
        Based on these favorites, recommend 10 to 15 apps from the provided catalog that the user might like.
        Return ONLY a JSON array of the recommended app IDs (package names).
        
        Catalog:
        ${JSON.stringify(appCatalog)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING
            }
          }
        }
      });

      const recommendedIds = JSON.parse(response.text || '[]');
      res.json({ recommendations: recommendedIds });
    } catch (error) {
      console.error('AI Recommendation Error:', error);
      res.status(500).json({ error: 'Failed to generate recommendations' });
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
