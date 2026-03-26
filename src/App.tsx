import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Download, ExternalLink, Github, Globe, X, Filter, ChevronRight, Package, ShieldCheck, Star, Settings, RefreshCw, LogIn, LogOut, Sparkles } from 'lucide-react';
import DOMPurify from 'dompurify';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from './lib/utils';
import { AppData, RepoData } from './types';
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

// --- Hooks ---
function useIntersectionObserver(callback: () => void, deps: any[]) {
  const observerTarget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          callback();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, deps);
  return observerTarget;
}

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// --- Components ---

const SmartImage = ({ src, fallbacks, alt, className, imgClassName, ...props }: any) => {
  const [currentSrcIndex, setCurrentSrcIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const allSrcs = useMemo(() => [src, ...(fallbacks || [])].filter(Boolean), [src, fallbacks]);
  const currentSrc = allSrcs[currentSrcIndex];

  // Reset state when the primary src changes
  useEffect(() => {
    setCurrentSrcIndex(0);
    setIsLoaded(false);
    setHasError(false);
    
    // Check if image is already in cache
    if (imgRef.current?.complete) {
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden flex items-center justify-center bg-surface-container-low", className)}>
      {/* Placeholder gradient - only show if not loaded and no error */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high to-surface-container animate-pulse z-10" />
      )}
      
      {!hasError && (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          className={cn(
            "w-full h-full object-contain transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            imgClassName
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (currentSrcIndex < allSrcs.length - 1) {
              setCurrentSrcIndex(prev => prev + 1);
            } else {
              setHasError(true);
              setIsLoaded(true);
            }
          }}
          {...props}
        />
      )}
      
      {/* Fallback if all fail */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-highest text-on-surface-variant font-display font-bold text-2xl">
          {alt?.charAt(0)?.toUpperCase()}
        </div>
      )}
    </div>
  );
};

interface AppCardProps {
  key?: React.Key;
  app: AppData;
  onClick: () => void;
  isFavorite: boolean;
  toggleFavorite: (id: string) => void;
}

const AppCard = ({ app, onClick, isFavorite, toggleFavorite }: AppCardProps) => {
  const baseUrl = app.repoUrl || 'https://f-droid.org/repo';
  
  const iconUrls = useMemo(() => {
    if (!app.icon) return [];
    if (app.icon.startsWith('http')) return [app.icon];
    
    // Ensure baseUrl is HTTPS and ends with /repo for standard F-Droid repos
    let cleanBaseUrl = baseUrl.replace('http://', 'https://');
    if (cleanBaseUrl.includes('f-droid.org') && !cleanBaseUrl.endsWith('/repo')) {
      cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '') + '/repo';
    }

    const filename = app.icon.includes('/') ? app.icon.split('/').pop() : app.icon;
    const basePaths = [
      `${cleanBaseUrl}/icons-640/${filename}`,
      `${cleanBaseUrl}/icons-320/${filename}`,
      `${cleanBaseUrl}/icons-240/${filename}`,
      `${cleanBaseUrl}/icons-160/${filename}`,
      `${cleanBaseUrl}/icons-120/${filename}`,
      `${cleanBaseUrl}/icons-192/${filename}`,
      `${cleanBaseUrl}/icons-144/${filename}`,
      `${cleanBaseUrl}/icons-96/${filename}`,
      `${cleanBaseUrl}/icons-72/${filename}`,
      `${cleanBaseUrl}/icons-48/${filename}`,
      `${cleanBaseUrl}/icons/${filename}`,
      `${cleanBaseUrl}/${filename}`
    ];
    
    if (app.icon.includes('/')) {
      return [`${cleanBaseUrl}/${app.icon}`, ...basePaths];
    }
    return basePaths;
  }, [app.icon, baseUrl]);
      
  const dicebearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${app.name}&backgroundColor=181818&textColor=ffffff`;
  const fallbacks = useMemo(() => [...(iconUrls.length > 0 ? iconUrls.slice(1) : []), dicebearUrl], [iconUrls, dicebearUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className="relative group bg-surface-container-low p-3.5 rounded-[28px] cursor-pointer flex flex-col h-full transition-all hover:bg-surface-container border border-surface-variant/20 hover:border-primary/30 shadow-sm hover:shadow-lg"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
        className="absolute top-2 right-2 p-2 rounded-full hover:bg-surface-variant transition-colors z-10"
      >
        <Star size={18} className={cn(isFavorite ? "fill-primary text-primary" : "text-on-surface-variant")} />
      </button>
      
      <div className="flex flex-col items-center text-center gap-3 mb-3 mt-1">
        <SmartImage
          src={iconUrls[0]}
          fallbacks={fallbacks}
          alt={app.name}
          className="w-16 h-16 rounded-[14px] shadow-sm border border-outline-variant/20 group-hover:shadow-primary/10 transition-shadow bg-surface-container-highest"
          imgClassName="rounded-[12px]"
        />
        <div className="flex flex-col">
          <h3 className="font-display font-semibold text-base text-on-surface line-clamp-1">{app.name}</h3>
          <span className="text-xs text-on-surface-variant line-clamp-1">{app.authorName || 'Unknown Developer'}</span>
        </div>
      </div>
      
      <p className="text-on-surface-variant text-xs line-clamp-2 mb-3 flex-grow text-center">{app.summary}</p>
      
      <div className="flex items-center justify-center gap-1.5 mt-auto overflow-hidden flex-wrap">
        {(app.categories || []).slice(0, 2).map(cat => (
          <span key={cat} className="text-[10px] font-medium bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-md whitespace-nowrap">
            {cat}
          </span>
        ))}
        <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md whitespace-nowrap">
          v{app.versionName}
        </span>
      </div>
    </motion.div>
  );
};

interface AppDetailsProps {
  app: AppData;
  onClose: () => void;
  isFavorite: boolean;
  toggleFavorite: (id: string) => void;
}

const AppDetails = ({ app, onClose, isFavorite, toggleFavorite }: AppDetailsProps) => {
  const baseUrl = app.repoUrl || 'https://f-droid.org/repo';
  const downloadUrl = `${baseUrl}/${app.apkName}`;
  
  const iconUrls = useMemo(() => {
    if (!app.icon) return [];
    if (app.icon.startsWith('http')) return [app.icon];
    
    // Ensure baseUrl is HTTPS and ends with /repo for standard F-Droid repos
    let cleanBaseUrl = baseUrl.replace('http://', 'https://');
    if (cleanBaseUrl.includes('f-droid.org') && !cleanBaseUrl.endsWith('/repo')) {
      cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '') + '/repo';
    }

    const filename = app.icon.includes('/') ? app.icon.split('/').pop() : app.icon;
    const basePaths = [
      `${cleanBaseUrl}/icons-640/${filename}`,
      `${cleanBaseUrl}/icons-320/${filename}`,
      `${cleanBaseUrl}/icons-240/${filename}`,
      `${cleanBaseUrl}/icons-160/${filename}`,
      `${cleanBaseUrl}/icons-120/${filename}`,
      `${cleanBaseUrl}/icons-192/${filename}`,
      `${cleanBaseUrl}/icons-144/${filename}`,
      `${cleanBaseUrl}/icons-96/${filename}`,
      `${cleanBaseUrl}/icons-72/${filename}`,
      `${cleanBaseUrl}/icons-48/${filename}`,
      `${cleanBaseUrl}/icons/${filename}`,
      `${cleanBaseUrl}/${filename}`
    ];
    
    if (app.icon.includes('/')) {
      return [`${cleanBaseUrl}/${app.icon}`, ...basePaths];
    }
    return basePaths;
  }, [app.icon, baseUrl]);
      
  const dicebearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${app.name}&backgroundColor=cae6ff&textColor=001e30`;
  const fallbacks = useMemo(() => [...(iconUrls.length > 0 ? iconUrls.slice(1) : []), dicebearUrl], [iconUrls, dicebearUrl]);

  const coverImage = app.screenshots && app.screenshots.length > 0 ? `${baseUrl}/${app.screenshots[0]}` : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-8 bg-scrim/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-surface w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-[28px] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Floating */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-50 p-2 bg-surface/50 backdrop-blur-md hover:bg-surface rounded-full text-on-surface transition-colors shadow-sm"
        >
          <X size={20} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Hero Banner */}
          <div className="relative h-48 sm:h-64 w-full bg-surface-container-high overflow-hidden">
            {coverImage ? (
              <>
                <div className="absolute inset-0 bg-black/20 z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent z-10" />
                <SmartImage 
                  src={coverImage} 
                  alt="Cover" 
                  className="w-full h-full blur-xl scale-110 opacity-60"
                  imgClassName="object-cover"
                />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-container to-secondary-container opacity-50" />
            )}
          </div>

          {/* Content Area */}
          <div className="px-6 sm:px-8 pb-8 -mt-16 relative z-20">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-6">
              <div className="w-24 h-24 bg-surface rounded-[24px] p-1.5 shadow-xl border border-surface-variant/30 flex-shrink-0">
                <SmartImage
                  src={iconUrls[0]}
                  fallbacks={fallbacks}
                  alt={app.name}
                  className="w-full h-full rounded-[18px] bg-surface-container-highest"
                  imgClassName="rounded-[18px]"
                />
              </div>
              
              <div className="flex-1 pb-1">
                <h2 className="text-3xl font-display font-bold text-on-surface mb-1 tracking-tight">{app.name}</h2>
                <p className="text-lg text-primary font-medium">{app.authorName || 'Unknown Developer'}</p>
              </div>

              <div className="flex gap-2 pb-1 w-full sm:w-auto">
                <button 
                  onClick={() => toggleFavorite(app.id)} 
                  className="p-3 bg-secondary-container text-on-secondary-container rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  <Star size={20} className={cn(isFavorite && "fill-on-secondary-container")} />
                </button>
                <a 
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-6 py-3 bg-primary text-on-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
                >
                  <Download size={20} />
                  <span className="text-base">Install</span>
                </a>
              </div>
            </div>
            
            {/* Metadata Pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              <div className="px-3 py-1.5 bg-surface-container rounded-lg text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                <ShieldCheck size={16} className="text-primary" /> {app.license || 'Open Source'}
              </div>
              <div className="px-3 py-1.5 bg-surface-container rounded-lg text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                <Package size={16} className="text-secondary" /> v{app.versionName}
              </div>
              {app.sourceCode && (
                <a href={app.sourceCode} target="_blank" className="px-3 py-1.5 bg-surface-container hover:bg-surface-variant transition-colors rounded-lg text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                  <Github size={16} /> Source
                </a>
              )}
              {app.webSite && (
                <a href={app.webSite} target="_blank" className="px-3 py-1.5 bg-surface-container hover:bg-surface-variant transition-colors rounded-lg text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                  <Globe size={16} /> Website
                </a>
              )}
            </div>

            {/* Screenshots */}
            {((app.screenshots && app.screenshots.length > 0) || app.video) && (
              <div className="mb-8 -mx-6 sm:mx-0">
                <div className="flex gap-3 overflow-x-auto px-6 sm:px-0 pb-4 custom-scrollbar snap-x">
                  {app.video && (
                    <div className="flex-shrink-0 w-64 h-auto aspect-video rounded-xl overflow-hidden bg-surface-container-highest snap-center flex items-center justify-center relative group cursor-pointer shadow-sm border border-outline-variant/20">
                      {coverImage && <SmartImage src={coverImage} className="absolute inset-0 w-full h-full opacity-40 group-hover:opacity-30 transition-opacity" imgClassName="object-cover" />}
                      <a href={app.video} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center gap-2 text-on-surface">
                        <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform">
                          <ExternalLink size={20} />
                        </div>
                        <span className="font-medium text-sm drop-shadow-md">Watch Trailer</span>
                      </a>
                    </div>
                  )}
                  {app.screenshots?.map((screenshot, idx) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="flex-shrink-0 h-64 sm:h-80 min-w-[120px] rounded-xl overflow-hidden bg-surface-container snap-center shadow-sm border border-outline-variant/20 flex items-center justify-center cursor-pointer"
                    >
                      <SmartImage
                        src={`${baseUrl}/${screenshot}`}
                        alt={`${app.name} screenshot ${idx + 1}`}
                        className="h-full min-w-[120px]"
                        imgClassName="object-contain w-auto h-full"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <h3 className="text-xl font-display font-medium text-on-surface mb-3">About this app</h3>
                {app.description ? (
                  <div 
                    className="text-on-surface-variant leading-relaxed prose prose-base max-w-none prose-p:text-on-surface-variant prose-headings:text-on-surface prose-strong:text-on-surface prose-a:text-primary hover:prose-a:underline prose-li:text-on-surface-variant"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(app.description) }}
                  />
                ) : (
                  <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap text-base">{app.summary}</p>
                )}
              </div>

              <div className="space-y-5">
                <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-variant/30">
                  <h4 className="font-medium text-on-surface mb-6 text-lg">Information</h4>
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="text-on-surface-variant block mb-1">Package Name</span>
                      <span className="font-mono text-on-surface break-all">{app.packageName}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block mb-1">Last Updated</span>
                      <span className="text-on-surface font-medium">{new Date(app.lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block mb-1">Categories</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(app.categories || []).map(cat => (
                          <span key={cat} className="px-3 py-1 bg-surface-container-high rounded-lg text-xs font-medium text-on-surface">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null);
  const [activeTab, setActiveTab] = useState('For You');
  
  // Firebase Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // User Data State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>(['https://f-droid.org/repo/index-v1.json']);
  
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 40;

  const [showRepoModal, setShowRepoModal] = useState(false);
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  
  // AI Recommendations State
  const [recommendations, setRecommendations] = useState<{ title: string, apps: string[] }[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        // Reset to defaults if logged out
        setFavorites([]);
        setSelectedRepos(['https://f-droid.org/repo/index-v2.json']);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Data Listener
  useEffect(() => {
    if (isAuthReady && user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFavorites(data.favorites || []);
          setSelectedRepos(data.selectedRepos && data.selectedRepos.length > 0 ? data.selectedRepos : ['https://f-droid.org/repo/index-v2.json']);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });
      return () => unsubscribe();
    }
  }, [isAuthReady, user]);

  // Fetch Repositories
  useEffect(() => {
    setLoading(true);
    const urlsParam = selectedRepos.join(',');
    fetch(`/api/repo?urls=${encodeURIComponent(urlsParam)}`)
      .then(res => res.json())
      .then(data => {
        setRepoData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedRepos]);

  // Fetch AI Recommendations
  useEffect(() => {
    if (repoData && activeTab === 'For You') {
      const fetchRecommendations = async () => {
        // Check cache first
        const cacheKey = `ai_recs_${favorites.sort().join(',')}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            // Cache valid for 1 hour
            if (Date.now() - timestamp < 3600000) {
              setRecommendations(data);
              return;
            }
          } catch (e) {
            console.error("Error parsing cached recommendations", e);
          }
        }

        setLoadingRecommendations(true);
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            console.error("Gemini API Key not found in environment");
            setLoadingRecommendations(false);
            return;
          }

          const ai = new GoogleGenAI({ apiKey });
          
          // We only send a subset of app info to save tokens
          const appCatalog = repoData.apps.map((a: any) => ({ 
            id: a.packageName, 
            name: a.name, 
            summary: a.summary,
            categories: a.categories
          }));

          const prompt = `
            You are an expert app recommender and curator. 
            The user has favorited the following apps: ${favorites && favorites.length > 0 ? favorites.join(', ') : 'None yet'}.
            Based on these favorites (if any) and the provided catalog, curate 3 to 5 interesting categories of apps.
            For example, if they have favorites, you could include a "Because you liked X" category.
            Other categories could be "Hidden Gems", "Productivity Boosters", "Trending", "Privacy Focused", "Open Source Essentials", etc.
            For each category, recommend 4 to 8 apps from the provided catalog.
            Return ONLY a JSON array of objects, where each object has a "title" (the category name) and an "apps" array (containing the recommended app IDs / package names).
            
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
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    apps: { 
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["title", "apps"]
                }
              }
            }
          });

          const categorizedRecommendations = JSON.parse(response.text || '[]');
          setRecommendations(categorizedRecommendations);
          
          // Save to cache
          localStorage.setItem(cacheKey, JSON.stringify({
            data: categorizedRecommendations,
            timestamp: Date.now()
          }));
        } catch (err) {
          console.error("Failed to fetch recommendations", err);
        } finally {
          setLoadingRecommendations(false);
        }
      };

      fetchRecommendations();
    }
  }, [favorites, repoData, activeTab]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTab, selectedRepos]);

  const toggleFavorite = async (id: string) => {
    if (!user) {
      alert("Please sign in to save favorites.");
      return;
    }
    const newFavorites = favorites.includes(id) 
      ? favorites.filter(f => f !== id) 
      : [...favorites, id];
    
    setFavorites(newFavorites); // Optimistic update
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { favorites: newFavorites });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleAddCustomRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRepoUrl) return;
    
    const newRepos = [...selectedRepos, customRepoUrl];
    
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { selectedRepos: newRepos });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    } else {
      setSelectedRepos(newRepos);
    }
    
    setCustomRepoUrl('');
    setShowRepoModal(false);
  };

  const toggleRepoSelection = async (url: string) => {
    let newRepos;
    if (selectedRepos.includes(url)) {
      if (selectedRepos.length === 1) return; // Prevent deselecting all
      newRepos = selectedRepos.filter(r => r !== url);
    } else {
      newRepos = [...selectedRepos, url];
    }

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { selectedRepos: newRepos });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    } else {
      setSelectedRepos(newRepos);
    }
  };

  const categories = useMemo(() => {
    if (!repoData) return [];
    const cats = new Set<string>();
    repoData.apps.forEach(app => {
      if (app.categories && Array.isArray(app.categories)) {
        app.categories.forEach(c => cats.add(c));
      }
    });
    return Array.from(cats).sort();
  }, [repoData]);

  const filteredApps = useMemo(() => {
    if (!repoData) return [];
    
    let baseApps = repoData.apps;

    // Apply AI Recommendations for "For You" tab if available
    // We handle the display of categorized recommendations separately in the render
    if (activeTab === 'For You' && !searchQuery) {
      const recommendedIds = recommendations.length > 0 ? recommendations.flatMap(r => r.apps) : [];
      
      // For the main grid, we want to show a diverse mix of apps
      // Let's prioritize apps with icons, screenshots, and good descriptions
      const interestingApps = baseApps
        .filter(a => !recommendedIds.includes(a.id))
        .filter(a => a.icon && a.summary && a.summary.length > 20)
        // Sort by lastUpdated to keep it stable but fresh
        .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
        .slice(0, 60);
        
      baseApps = interestingApps;
    }

    return baseApps.filter(app => {
      const name = app.name || '';
      const summary = app.summary || '';
      const query = searchQuery.toLowerCase();
      
      const matchesSearch = name.toLowerCase().includes(query) ||
                          summary.toLowerCase().includes(query);
      
      let matchesTab = true;
      if (activeTab === 'Favorites') {
        matchesTab = favorites.includes(app.id);
      } else if (activeTab !== 'For You') {
        matchesTab = app.categories && app.categories.includes(activeTab);
      }
      
      return matchesSearch && matchesTab;
    });
  }, [repoData, searchQuery, activeTab, favorites, recommendations]);

  const displayedApps = useMemo(() => {
    return filteredApps.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredApps, page]);

  const loadMoreRef = useIntersectionObserver(() => {
    if (displayedApps.length < filteredApps.length) {
      setPage(p => p + 1);
    }
  }, [displayedApps.length, filteredApps.length]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-surface selection:bg-primary selection:text-on-primary">
      <header className="pt-8 pb-4 px-4 sm:px-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-medium text-on-surface mb-1">
              {getGreeting()}{user ? `, ${user.displayName?.split(' ')[0]}` : ''}
            </h1>
            <p className="text-on-surface-variant text-base">
              Explore {repoData?.apps.length || 'thousands of'} open source apps
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setShowRepoModal(true)} 
              className="w-12 h-12 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            >
              <Settings size={20} />
            </button>
            {user ? (
              <button onClick={logOut} className="w-12 h-12 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <LogOut size={20} />}
              </button>
            ) : (
              <button onClick={signInWithGoogle} className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-opacity shadow-md shadow-primary/20">
                <LogIn size={20} />
              </button>
            )}
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input
            type="text"
            placeholder="Search apps, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface placeholder:text-on-surface-variant rounded-full py-3.5 pl-14 pr-5 focus:outline-none focus:ring-2 focus:ring-primary transition-all text-base"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {['For You', 'Favorites', ...categories].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                activeTab === tab 
                  ? "bg-secondary-container text-on-secondary-container" 
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 sm:px-6 pb-20">
        <div className="max-w-[1600px] mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {[...Array(18)].map((_, i) => (
                <div key={i} className="bg-surface-container-low p-4 rounded-[24px] h-56 flex flex-col items-center text-center animate-pulse border border-surface-variant/20">
                  <div className="w-16 h-16 rounded-[14px] bg-surface-container-highest mb-3" />
                  <div className="h-4 bg-surface-container-highest rounded-full w-3/4 mb-2" />
                  <div className="h-3 bg-surface-container-highest rounded-full w-1/2 mb-4" />
                  <div className="h-3 bg-surface-container-highest rounded-full w-full mb-2" />
                  <div className="h-3 bg-surface-container-highest rounded-full w-5/6 mt-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {activeTab === 'For You' && loadingRecommendations ? (
                <div className="space-y-10">
                  <div className="flex items-center gap-2 text-primary mb-4 p-3.5 bg-primary/10 rounded-xl text-sm">
                    <Sparkles className="animate-pulse" size={18} />
                    <span className="font-medium">AI is curating your recommendations...</span>
                  </div>
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="space-y-4">
                      <div className="h-7 bg-surface-container-high rounded-lg w-48 animate-pulse" />
                      <div className="flex gap-4 overflow-hidden">
                        {[...Array(6)].map((_, j) => (
                          <div key={j} className="shrink-0 w-[160px] sm:w-[180px] h-56 bg-surface-container-low rounded-[24px] animate-pulse border border-surface-variant/20" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {activeTab === 'For You' && !searchQuery && recommendations.length > 0 && (
                    <div className="space-y-10 mb-10">
                      {recommendations.map((category, idx) => {
                        const categoryApps = category.apps
                          .map(id => repoData?.apps.find(a => a.id === id))
                          .filter(Boolean) as AppData[];
                        
                        if (categoryApps.length === 0) return null;

                        return (
                          <section key={idx}>
                            <h2 className="text-xl font-display font-medium text-on-surface mb-4 flex items-center gap-2">
                              <Sparkles className="text-primary" size={20} />
                              {category.title}
                            </h2>
                            <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-4 snap-x snap-mandatory no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
                              {categoryApps.map(app => (
                                <div key={app.id} className="snap-start shrink-0 w-[160px] sm:w-[180px]">
                                  <AppCard 
                                    app={app} 
                                    onClick={() => setSelectedApp(app)} 
                                    isFavorite={favorites.includes(app.id)}
                                    toggleFavorite={toggleFavorite}
                                  />
                                </div>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}

                  {(!recommendations.length || activeTab !== 'For You' || searchQuery) ? (
                    <motion.div 
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                    >
                      <AnimatePresence mode="popLayout">
                        {displayedApps.map(app => (
                          <AppCard 
                            key={app.id} 
                            app={app} 
                            onClick={() => setSelectedApp(app)} 
                            isFavorite={favorites.includes(app.id)}
                            toggleFavorite={toggleFavorite}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <section>
                      <h2 className="text-xl font-display font-medium text-on-surface mb-4">
                        More Apps to Explore
                      </h2>
                      <motion.div 
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                      >
                        <AnimatePresence mode="popLayout">
                          {displayedApps.map(app => (
                            <AppCard 
                              key={app.id} 
                              app={app} 
                              onClick={() => setSelectedApp(app)} 
                              isFavorite={favorites.includes(app.id)}
                              toggleFavorite={toggleFavorite}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {!loading && displayedApps.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={32} className="text-on-surface-variant" />
              </div>
              <h3 className="text-2xl font-display font-medium text-on-surface mb-2">No apps found</h3>
              <p className="text-on-surface-variant">Try adjusting your search or category filter.</p>
            </div>
          )}

          {/* Infinite Scroll Target */}
          {!loading && displayedApps.length < filteredApps.length && (
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </main>

      {/* App Details Modal */}
      <AnimatePresence>
        {selectedApp && (
          <AppDetails 
            app={selectedApp} 
            onClose={() => setSelectedApp(null)} 
            isFavorite={favorites.includes(selectedApp.id)}
            toggleFavorite={toggleFavorite}
          />
        )}
      </AnimatePresence>

      {/* Repo Modal */}
      <AnimatePresence>
        {showRepoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm"
            onClick={() => setShowRepoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[28px] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-display font-medium text-on-surface mb-6">Repositories</h3>
              
              <div className="space-y-2 mb-6 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                {[
                  { name: 'F-Droid Official', url: 'https://f-droid.org/repo/index-v1.json' },
                  { name: 'IzzyOnDroid', url: 'https://apt.izzysoft.de/fdroid/repo/index-v1.json' },
                  // Add custom repos here if needed, or fetch from a global list
                ].map(repo => (
                  <button
                    key={repo.url}
                    onClick={() => toggleRepoSelection(repo.url)}
                    className={cn(
                      "w-full text-left px-4 py-4 rounded-[16px] transition-all flex items-center justify-between",
                      selectedRepos.includes(repo.url)
                        ? "bg-primary-container text-on-primary-container font-medium" 
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                    )}
                  >
                    {repo.name}
                    {selectedRepos.includes(repo.url) && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </button>
                ))}
                {/* Display custom selected repos that aren't in the default list */}
                {selectedRepos.filter(url => !['https://f-droid.org/repo/index-v1.json', 'https://apt.izzysoft.de/fdroid/repo/index-v1.json'].includes(url)).map(url => (
                   <button
                   key={url}
                   onClick={() => toggleRepoSelection(url)}
                   className="w-full text-left px-4 py-4 rounded-[16px] transition-all flex items-center justify-between bg-primary-container text-on-primary-container font-medium"
                 >
                   {new URL(url).hostname}
                   <div className="w-2 h-2 bg-primary rounded-full" />
                 </button>
                ))}
              </div>

              <form onSubmit={handleAddCustomRepo} className="pt-6 border-t border-outline-variant/30">
                <h4 className="text-sm font-medium text-on-surface-variant mb-4">Add Custom Repository</h4>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/repo/index-v1.json"
                  value={customRepoUrl}
                  onChange={(e) => setCustomRepoUrl(e.target.value)}
                  className="w-full bg-surface-container text-on-surface placeholder:text-on-surface-variant rounded-[16px] py-3 px-4 mb-4 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowRepoModal(false)}
                    className="flex-1 py-3 rounded-full font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-on-primary py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
                  >
                    Add
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
