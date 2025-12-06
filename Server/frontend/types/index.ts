// User types
export interface User {
  id: string
  email: string
  username: string
  full_name?: string
  avatar_url?: string
  role: 'admin' | 'member' | 'viewer'
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Project types
export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  team_id?: string
  created_by: string
  is_active: boolean
  retention_days: number
  created_at: Date
  updated_at: Date
}

// Test Script types
export interface TestScript {
  id: string
  project_id: string
  name: string
  version: number
  description?: string
  script_content: ScriptContent
  metadata?: Record<string, any>
  created_by: string
  is_locked_by?: string
  file_path?: string
  file_size?: number
  checksum?: string
  created_at: Date
  updated_at: Date
}

export interface ScriptContent {
  id: string
  name: string
  version: number
  steps: ScriptStep[]
  variables: string[]
}

export interface ScriptStep {
  id: string
  type: 'navigate' | 'click' | 'type' | 'select' | 'assert' | 'wait' | 'screenshot'
  url?: string
  selectors?: Selector[]
  value?: string
  assertion?: string
  duration?: number
  timeout?: number
  metadata?: Record<string, any>
}

export interface Selector {
  type: 'css' | 'xpath' | 'id' | 'name' | 'class'
  value: string
}

// Test Execution types
export interface TestExecution {
  id: string
  script_id: string
  execution_id: string
  executed_by: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  data_row_index?: number
  start_time?: Date
  end_time?: Date
  duration_ms?: number
  browser_type?: string
  browser_version?: string
  error_message?: string
  error_stack?: string
  results?: ExecutionResults
  metadata?: Record<string, any>
  created_at: Date
}

export interface ExecutionResults {
  passed: number
  failed: number
  skipped: number
  total: number
  steps?: TestStepResult[]
}

export interface TestStepResult {
  id: string
  execution_id: string
  step_id: string
  status: 'passed' | 'failed' | 'skipped' | 'warning'
  start_time?: Date
  end_time?: Date
  duration_ms?: number
  selector_used?: string
  error_message?: string
  screenshot_path?: string
  visual_baseline_path?: string
  visual_diff_path?: string
  visual_similarity?: number
  metadata?: Record<string, any>
  created_at: Date
}

// Team types
export interface Team {
  id: string
  name: string
  slug: string
  description?: string
  created_by: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface TeamMembership {
  id: string
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  invited_by?: string
  joined_at: Date
}

// Test Data File types
export interface TestDataFile {
  id: string
  project_id: string
  name: string
  file_path: string
  file_type: 'csv' | 'xlsx' | 'json'
  file_size: number
  checksum?: string
  column_info?: ColumnInfo[]
  row_count?: number
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface ColumnInfo {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  required: boolean
  validation?: {
    pattern?: string
    min?: number
    max?: number
  }
}

// Visual Baseline types
export interface VisualBaseline {
  id: string
  script_id: string
  step_id: string
  browser_type?: string
  viewport_width?: number
  viewport_height?: number
  baseline_path: string
  similarity_threshold: number
  is_active: boolean
  created_by: string
  created_at: Date
}

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
  status: 'success' | 'error'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// Form types
export interface LoginForm {
  email: string
  password: string
  remember_me?: boolean
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirm_password: string
  full_name?: string
}

// Chart data types
export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string
  borderColor?: string
  tension?: number
  fill?: boolean
}