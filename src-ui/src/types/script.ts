export interface TestScript {
  id: string;
  name: string;
  description?: string;
  steps: TestStep[];
  created_at: string;
  updated_at: string;
  tags?: string[];
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed';
}

export interface TestStep {
  id: string;
  action: StepAction;
  target_element?: ElementInfo;
  value?: string;
  selectors: Selector[];
  wait_time?: number;
  screenshot?: string;
  order_index: number;
}

export type StepAction =
  | 'click'
  | 'type'
  | 'navigate'
  | 'scroll'
  | 'wait'
  | 'hover'
  | 'double_click'
  | 'right_click'
  | 'select'
  | 'upload_file';

export interface ElementInfo {
  tag_name: string;
  text_content?: string;
  attributes: Record<string, string>;
  bounding_rect?: DOMRect;
}

export interface Selector {
  strategy: SelectorStrategy;
  value: string;
  confidence: number;
  priority: number;
}

export type SelectorStrategy =
  | 'id'
  | 'class'
  | 'xpath'
  | 'css'
  | 'text'
  | 'data_attribute'
  | 'aria_label'
  | 'placeholder'
  | 'name';

export interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RecordingSession {
  id: string;
  name: string;
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  start_time?: string;
  end_time?: string;
  steps: TestStep[];
  current_url?: string;
}