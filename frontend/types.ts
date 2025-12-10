export enum ActionType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  TYPE = 'type',
  ASSERT_TEXT = 'assert_text',
  SCREENSHOT = 'screenshot',
}

export interface Locator {
  type: 'id' | 'css' | 'xpath';
  value: string;
  priority: number;
}

export interface ScriptStep {
  id: number;
  name: string;
  action: ActionType;
  value?: string;
  expectedValue?: string;
  timeout?: number;
  selectors?: Locator[];
}

export interface Script {
  id: string;
  name: string;
  module: string;
  lastModifiedBy: string;
  lastRunStatus: 'PASS' | 'FAIL' | 'SKIP' | 'PENDING';
  steps: ScriptStep[];
  dataDrivenFile?: string;
}

export interface ModuleNode {
  id: string;
  name: string;
  description?: string;
  inheritedFrom?: string; // If null, it's new/modified in this version. If set, it refers to version ID.
  scripts: Script[];
}

export interface ProjectVersion {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'draft';
  releaseDate: string;
  modules: ModuleNode[];
  stats: {
    passRate: number;
    coverage: number;
    totalScripts: number;
  };
}

export interface Project {
  id: string;
  name: string;
  icon?: string;
  versions: ProjectVersion[];
}

export interface TestResultLog {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'ERROR';
  message: string;
}

export interface VisualDiffData {
  baselineUrl: string;
  actualUrl: string;
  diffPercentage: number;
  tolerance: number;
}

export interface ServerNode {
  id: string;
  name: string;
  ip: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  os: 'windows' | 'mac' | 'linux';
  browsers: string[];
  cpuUsage: number;
  memUsage: number;
  activeSessions: number;
  maxSessions: number;
}