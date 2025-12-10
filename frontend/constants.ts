import { ActionType, Project, ScriptStep, TestResultLog, VisualDiffData, ServerNode } from './types';

export const MOCK_SCRIPT_STEPS: ScriptStep[] = [
  {
    id: 1,
    name: "Navigate to Login Page",
    action: ActionType.NAVIGATE,
    value: "https://portal.uitrace.com/login",
    timeout: 30
  },
  {
    id: 2,
    name: "Input Username",
    action: ActionType.TYPE,
    value: "${Username}",
    timeout: 15,
    selectors: [
      { priority: 1, type: 'id', value: 'username-field-v3' },
      { priority: 2, type: 'css', value: 'input[name="user"]' },
      { priority: 3, type: 'xpath', value: '//form//input[1]' },
    ]
  },
  {
    id: 3,
    name: "Input Password",
    action: ActionType.TYPE,
    value: "${Password}",
    timeout: 15,
    selectors: [
      { priority: 1, type: 'id', value: 'password-field' },
      { priority: 2, type: 'css', value: 'input[type="password"]' },
    ]
  },
  {
    id: 4,
    name: "Click Login Button",
    action: ActionType.CLICK,
    timeout: 15,
    selectors: [
      { priority: 1, type: 'id', value: 'submit-login-v2' },
      { priority: 2, type: 'css', value: 'button.primary-btn' },
    ]
  },
  {
    id: 5,
    name: "Verify Dashboard Loaded",
    action: ActionType.ASSERT_TEXT,
    expectedValue: "Welcome, ${Username}",
    timeout: 20,
    selectors: [
      { priority: 1, type: 'css', value: 'h1.welcome-msg' }
    ]
  }
];

// Replaced ModuleNode list with structured MOCK_PROJECTS
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'E-Commerce Storefront',
    icon: 'shopping-bag',
    versions: [
      {
        id: 'v2.1.0',
        name: 'v2.1.0 (Current)',
        status: 'active',
        releaseDate: '2023-10-25',
        stats: { passRate: 92, coverage: 85, totalScripts: 45 },
        modules: [
          {
            id: 'mod-auth',
            name: 'Authentication',
            description: 'User login, registration and SSO flows',
            scripts: [
               { id: 'tc-001', name: 'Login Success', module: 'Authentication', lastModifiedBy: 'Alice', lastRunStatus: 'PASS', steps: MOCK_SCRIPT_STEPS },
               { id: 'tc-002', name: 'Login Failure', module: 'Authentication', lastModifiedBy: 'Bob', lastRunStatus: 'FAIL', steps: [] },
            ]
          },
          {
            id: 'mod-checkout',
            name: 'Checkout',
            description: 'Cart management and payment gateway',
            scripts: [
               { id: 'tc-010', name: 'Add to Cart', module: 'Checkout', lastModifiedBy: 'Charlie', lastRunStatus: 'PASS', steps: [] },
               { id: 'tc-011', name: 'Payment Flow', module: 'Checkout', lastModifiedBy: 'Charlie', lastRunStatus: 'PENDING', steps: [] },
            ]
          },
          {
            id: 'mod-search',
            name: 'Search Engine',
            description: 'Product search and filtering (Inherited)',
            inheritedFrom: 'v2.0.0',
            scripts: [
               { id: 'tc-020', name: 'Search by Keyword', module: 'Search', lastModifiedBy: 'David', lastRunStatus: 'PASS', steps: [] },
            ]
          }
        ]
      },
      {
        id: 'v2.0.0',
        name: 'v2.0.0',
        status: 'archived',
        releaseDate: '2023-09-10',
        stats: { passRate: 98, coverage: 80, totalScripts: 40 },
        modules: [
          {
            id: 'mod-auth',
            name: 'Authentication',
            scripts: [
               { id: 'tc-001', name: 'Login Success', module: 'Authentication', lastModifiedBy: 'Alice', lastRunStatus: 'PASS', steps: [] },
            ]
          },
           {
            id: 'mod-search',
            name: 'Search Engine',
            scripts: [
               { id: 'tc-020', name: 'Search by Keyword', module: 'Search', lastModifiedBy: 'David', lastRunStatus: 'PASS', steps: [] },
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'proj-2',
    name: 'Admin Dashboard Portal',
    icon: 'layout',
    versions: [
       {
        id: 'v1.5.0',
        name: 'v1.5.0',
        status: 'active',
        releaseDate: '2023-10-01',
        stats: { passRate: 88, coverage: 60, totalScripts: 12 },
        modules: [
          {
             id: 'mod-users',
             name: 'User Management',
             scripts: []
          }
        ]
       }
    ]
  }
];

export const MOCK_LOGS: TestResultLog[] = [
  { timestamp: '10:00:01', level: 'INFO', message: 'Starting Test Case TC002...' },
  { timestamp: '10:00:02', level: 'INFO', message: 'Step 1: Navigate to Login Page - SUCCESS' },
  { timestamp: '10:00:02', level: 'DEBUG', message: 'Loaded data row: { Username: "test_user", Password: "***" }' },
  { timestamp: '10:00:03', level: 'INFO', message: 'Step 2: Input Username - SUCCESS' },
  { timestamp: '10:00:05', level: 'DEBUG', message: 'Attempting to locate element by ID: submit-login-v2...' },
  { timestamp: '10:00:10', level: 'DEBUG', message: 'Locator ID failed. Retrying with CSS: button.primary-btn...' },
  { timestamp: '10:00:15', level: 'ERROR', message: 'Step 3: Click Login Button - FAILED. Element not interactable after 15s.' },
];

export const MOCK_VISUAL_DIFF: VisualDiffData = {
  baselineUrl: 'https://picsum.photos/id/1/800/600', // A laptop
  actualUrl: 'https://picsum.photos/id/119/800/600', // A laptop (but different enough to simulate change if we pretend)
  diffPercentage: 12.5,
  tolerance: 5
};

export const DAILY_STATS = [
  { name: 'Mon', pass: 40, fail: 5, skip: 2 },
  { name: 'Tue', pass: 45, fail: 2, skip: 1 },
  { name: 'Wed', pass: 42, fail: 8, skip: 5 },
  { name: 'Thu', pass: 50, fail: 1, skip: 0 },
  { name: 'Fri', pass: 48, fail: 3, skip: 2 },
  { name: 'Sat', pass: 20, fail: 0, skip: 0 },
  { name: 'Sun', pass: 25, fail: 0, skip: 0 },
];

export const MOCK_NODES: ServerNode[] = [
  {
    id: 'node-01',
    name: 'Win11-Execution-01',
    ip: '192.168.1.101',
    status: 'ONLINE',
    os: 'windows',
    browsers: ['chrome', 'edge'],
    cpuUsage: 45,
    memUsage: 60,
    activeSessions: 2,
    maxSessions: 5
  },
  {
    id: 'node-02',
    name: 'Linux-Headless-01',
    ip: '192.168.1.102',
    status: 'BUSY',
    os: 'linux',
    browsers: ['chrome', 'firefox'],
    cpuUsage: 88,
    memUsage: 75,
    activeSessions: 5,
    maxSessions: 5
  },
   {
    id: 'node-03',
    name: 'MacMini-Safari-01',
    ip: '192.168.1.105',
    status: 'OFFLINE',
    os: 'mac',
    browsers: ['safari', 'chrome'],
    cpuUsage: 0,
    memUsage: 0,
    activeSessions: 0,
    maxSessions: 2
  }
];