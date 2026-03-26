import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Download, ExternalLink, Github, Globe, X, Filter, ChevronRight, Package, ShieldCheck, Star, Settings, RefreshCw } from 'lucide-react';
import DOMPurify from 'dompurify';
import { cn } from './lib/utils';
import { AppData, RepoData } from './types';

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

interface AppCardProps {
  key?: React.Key;
  app: AppData;
  onClick: () => void;
  repoUrl: string;
  isFavorite: boolean;
  toggleFavorite: (id: string) => void;
}

const AppCard = ({ app, onClick, repoUrl, isFavorite, toggleFavorite }: AppCardProps) => {
  const baseUrl = repoUrl.replace('/index-v1.json', '');
  
  const iconUrl = app.icon?.startsWith('http') ? app.icon : `${baseUrl}/icons-320/${app.icon}`;
  const fallbackIconUrl = app.icon?.startsWith('http') ? app.icon : `${baseUrl}/icons/${app.icon}`;
  const dicebearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${app.name}&backgroundColor=181818&textColor=ffffff`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative group bg-surface-container-low p-5 rounded-3xl cursor-pointer flex flex-col h-full transition-all hover:bg-surface-container-high border border-surface-variant/20 hover:border-surface-variant/50 shadow-sm hover:shadow-xl hover:shadow-black/50"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
        className="absolute top-3 right-3 p-2 rounded-full hover:bg-surface-variant transition-colors z-10"
      >
        <Star size={22} className={cn(isFavorite ? "fill-primary text-primary" : "text-on-surface-variant")} />
      </button>
      
      <div className="flex flex-col items-center text-center gap-4 mb-4 mt-2">
        <div className="w-24 h-24 rounded-[20px] bg-surface-container-highest p-1 flex-shrink-0 shadow-lg border border-surface-variant/30 group-hover:shadow-primary/20 transition-shadow">
          <img
            src={iconUrl}
            alt={app.name}
            className="w-full h-full object-contain rounded-[16px]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src.includes(iconUrl) && iconUrl !== fallbackIconUrl) {
                target.src = fallbackIconUrl;
              } else if (target.src !== dicebearUrl) {
                target.src = dicebearUrl;
              }
            }}
          />
        </div>
        <div className="flex flex-col">
          <h3 className="font-display font-semibold text-lg text-on-surface line-clamp-1">{app.name}</h3>
          <span className="text-sm text-on-surface-variant line-clamp-1">{app.authorName || 'Unknown Developer'}</span>
        </div>
      </div>
      
      <p className="text-on-surface-variant text-sm line-clamp-2 mb-4 flex-grow text-center">{app.summary}</p>
      
      <div className="flex items-center justify-center gap-2 mt-auto overflow-hidden flex-wrap">
        {(app.categories || []).slice(0, 2).map(cat => (
          <span key={cat} className="text-[11px] font-medium bg-surface-container-highest text-on-surface-variant px-2.5 py-1 rounded-lg whitespace-nowrap">
            {cat}
          </span>
        ))}
        <span className="text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-lg whitespace-nowrap">
          v{app.versionName}
        </span>
      </div>
    </motion.div>
  );
};

interface AppDetailsProps {
  app: AppData;
  onClose: () => void;
  repoUrl: string;
  isFavorite: boolean;
  toggleFavorite: (id: string) => void;
}

const AppDetails = ({ app, onClose, repoUrl, isFavorite, toggleFavorite }: AppDetailsProps) => {
  const baseUrl = repoUrl.replace('/index-v1.json', '');
  const downloadUrl = `${baseUrl}/${app.apkName}`;
  
  const iconUrl = app.icon?.startsWith('http') ? app.icon : `${baseUrl}/icons-320/${app.icon}`;
  const fallbackIconUrl = app.icon?.startsWith('http') ? app.icon : `${baseUrl}/icons/${app.icon}`;
  const dicebearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${app.name}&backgroundColor=cae6ff&textColor=001e30`;

  const coverImage = app.screenshots && app.screenshots.length > 0 ? `${baseUrl}/${app.screenshots[0]}` : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-scrim/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-surface w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Floating */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-50 p-2 bg-surface/50 backdrop-blur-md hover:bg-surface rounded-full text-on-surface transition-colors shadow-sm"
        >
          <X size={24} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Hero Banner */}
          <div className="relative h-64 sm:h-80 w-full bg-surface-container-high overflow-hidden">
            {coverImage ? (
              <>
                <div className="absolute inset-0 bg-black/20 z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent z-10" />
                <img 
                  src={coverImage} 
                  alt="Cover" 
                  className="w-full h-full object-cover blur-xl scale-110 opacity-60"
                />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-container to-secondary-container opacity-50" />
            )}
          </div>

          {/* Content Area */}
          <div className="px-6 sm:px-12 pb-12 -mt-24 relative z-20">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 mb-8">
              <div className="w-32 h-32 bg-surface rounded-[28px] p-2 shadow-xl border border-surface-variant/30 flex-shrink-0">
                <img
                  src={iconUrl}
                  alt={app.name}
                  className="w-full h-full object-contain rounded-[20px]"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes(iconUrl) && iconUrl !== fallbackIconUrl) {
                      target.src = fallbackIconUrl;
                    } else if (target.src !== dicebearUrl) {
                      target.src = dicebearUrl;
                    }
                  }}
                />
              </div>
              
              <div className="flex-1 pb-2">
                <h2 className="text-4xl font-display font-bold text-on-surface mb-1 tracking-tight">{app.name}</h2>
                <p className="text-xl text-primary font-medium">{app.authorName || 'Unknown Developer'}</p>
              </div>

              <div className="flex gap-3 pb-2 w-full sm:w-auto">
                <button 
                  onClick={() => toggleFavorite(app.id)} 
                  className="p-4 bg-secondary-container text-on-secondary-container rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  <Star size={24} className={cn(isFavorite && "fill-on-secondary-container")} />
                </button>
                <a 
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-8 py-4 bg-primary text-on-primary rounded-2xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
                >
                  <Download size={24} />
                  <span className="text-lg">Install</span>
                </a>
              </div>
            </div>
            
            {/* Metadata Pills */}
            <div className="flex flex-wrap gap-3 mb-10">
              <div className="px-4 py-2 bg-surface-container rounded-xl text-sm text-on-surface-variant flex items-center gap-2 font-medium">
                <ShieldCheck size={18} className="text-primary" /> {app.license || 'Open Source'}
              </div>
              <div className="px-4 py-2 bg-surface-container rounded-xl text-sm text-on-surface-variant flex items-center gap-2 font-medium">
                <Package size={18} className="text-secondary" /> v{app.versionName}
              </div>
              {app.sourceCode && (
                <a href={app.sourceCode} target="_blank" className="px-4 py-2 bg-surface-container hover:bg-surface-variant transition-colors rounded-xl text-sm text-on-surface-variant flex items-center gap-2 font-medium">
                  <Github size={18} /> Source
                </a>
              )}
              {app.webSite && (
                <a href={app.webSite} target="_blank" className="px-4 py-2 bg-surface-container hover:bg-surface-variant transition-colors rounded-xl text-sm text-on-surface-variant flex items-center gap-2 font-medium">
                  <Globe size={18} /> Website
                </a>
              )}
            </div>

            {/* Screenshots */}
            {((app.screenshots && app.screenshots.length > 0) || app.video) && (
              <div className="mb-12 -mx-6 sm:mx-0">
                <div className="flex gap-4 overflow-x-auto px-6 sm:px-0 pb-6 custom-scrollbar snap-x">
                  {app.video && (
                    <div className="flex-shrink-0 w-72 sm:w-96 h-auto aspect-video rounded-2xl overflow-hidden bg-surface-container-highest snap-center flex items-center justify-center relative group cursor-pointer shadow-md">
                      {coverImage && <img src={coverImage} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-30 transition-opacity" />}
                      <a href={app.video} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center gap-3 text-on-surface">
                        <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <ExternalLink size={28} />
                        </div>
                        <span className="font-medium text-lg drop-shadow-md">Watch Trailer</span>
                      </a>
                    </div>
                  )}
                  {app.screenshots?.map((screenshot, idx) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="flex-shrink-0 h-80 sm:h-[400px] min-w-[150px] w-auto rounded-2xl overflow-hidden bg-surface-container snap-center shadow-md border border-surface-variant/30 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={`${baseUrl}/${screenshot}`}
                        alt={`${app.name} screenshot ${idx + 1}`}
                        className="h-full w-auto object-contain"
                        loading="lazy"
                        onError={(e) => {
                          if (e.target && (e.target as HTMLImageElement).parentElement) {
                            (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                          }
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2">
                <h3 className="text-2xl font-display font-medium text-on-surface mb-4">About this app</h3>
                {app.description ? (
                  <div 
                    className="text-on-surface-variant leading-relaxed prose prose-lg max-w-none prose-p:text-on-surface-variant prose-headings:text-on-surface prose-strong:text-on-surface prose-a:text-primary hover:prose-a:underline prose-li:text-on-surface-variant"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(app.description) }}
                  />
                ) : (
                  <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap text-lg">{app.summary}</p>
                )}
              </div>

              <div className="space-y-6">
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
  const [currentRepo, setCurrentRepo] = useState('https://f-droid.org/repo/index-v1.json');
  const [favorites, setFavorites] = useLocalStorage<string[]>('foss-hub-favorites', []);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 40;

  const [showRepoModal, setShowRepoModal] = useState(false);
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [repos, setRepos] = useLocalStorage('foss-hub-repos', [
    { name: 'F-Droid Official', url: 'https://f-droid.org/repo/index-v1.json' },
    { name: 'IzzyOnDroid', url: 'https://apt.izzysoft.de/fdroid/repo/index-v1.json' },
  ]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/repo?url=${encodeURIComponent(currentRepo)}`)
      .then(res => res.json())
      .then(data => {
        setRepoData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [currentRepo]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTab, currentRepo]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleAddCustomRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRepoUrl) return;
    const newRepo = { name: new URL(customRepoUrl).hostname, url: customRepoUrl };
    setRepos([...repos, newRepo]);
    setCurrentRepo(customRepoUrl);
    setCustomRepoUrl('');
    setShowRepoModal(false);
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
    return repoData.apps.filter(app => {
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
  }, [repoData, searchQuery, activeTab, favorites]);

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
      <header className="pt-12 pb-6 px-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-medium text-on-surface mb-2">
              {getGreeting()}, Parth
            </h1>
            <p className="text-on-surface-variant text-lg">
              Explore {repoData?.apps.length || 'thousands of'} open source apps
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowRepoModal(true)} 
              className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            >
              <Settings size={24} />
            </button>
            <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xl font-display font-medium shadow-sm">
              P
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full mb-8">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant" size={24} />
          <input
            type="text"
            placeholder="Search apps, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface placeholder:text-on-surface-variant rounded-full py-4 pl-16 pr-6 focus:outline-none focus:ring-2 focus:ring-primary transition-all text-lg"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <X size={20} />
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
                "px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
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

      <main className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-surface-container-low p-5 rounded-3xl h-64 flex flex-col items-center text-center animate-pulse border border-surface-variant/20">
                  <div className="w-24 h-24 rounded-[20px] bg-surface-container-highest mb-4" />
                  <div className="h-5 bg-surface-container-highest rounded-full w-3/4 mb-2" />
                  <div className="h-4 bg-surface-container-highest rounded-full w-1/2 mb-6" />
                  <div className="h-4 bg-surface-container-highest rounded-full w-full mb-2" />
                  <div className="h-4 bg-surface-container-highest rounded-full w-5/6 mt-auto" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {displayedApps.map(app => (
                  <AppCard 
                    key={app.id} 
                    app={app} 
                    onClick={() => setSelectedApp(app)} 
                    repoUrl={currentRepo}
                    isFavorite={favorites.includes(app.id)}
                    toggleFavorite={toggleFavorite}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
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
            repoUrl={currentRepo}
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
                {repos.map(repo => (
                  <button
                    key={repo.url}
                    onClick={() => {
                      setCurrentRepo(repo.url);
                      setShowRepoModal(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-4 rounded-[16px] transition-all flex items-center justify-between",
                      currentRepo === repo.url 
                        ? "bg-primary-container text-on-primary-container font-medium" 
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                    )}
                  >
                    {repo.name}
                    {currentRepo === repo.url && <div className="w-2 h-2 bg-primary rounded-full" />}
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
