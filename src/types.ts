export interface AppData {
  id: string;
  name: string;
  summary: string;
  description?: string;
  icon: string;
  categories: string[];
  added: number;
  lastUpdated: number;
  versionName: string;
  packageName: string;
  apkName: string;
  authorName?: string;
  license?: string;
  webSite?: string;
  sourceCode?: string;
  issueTracker?: string;
  changelog?: string;
  donate?: string;
  bitcoin?: string;
  litecoin?: string;
  flattrID?: string;
  liberapayID?: string;
  openCollective?: string;
  screenshots?: string[];
  video?: string;
}

export interface RepoData {
  repo: {
    name: string;
    address: string;
    description: string;
    icon: string;
    version: number;
    timestamp: number;
  };
  apps: AppData[];
}
