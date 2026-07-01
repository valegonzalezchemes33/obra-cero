// ── Brain Types ──

export type BrainIntent =
  | "query"          // General knowledge query
  | "search"         // Semantic search across memory
  | "analyze"        // Impact analysis
  | "plan"           // Feature estimation
  | "design"         // Feature design blueprint
  | "context"        // Project context
  | "architecture"   // Architecture explanation
  | "dead-code"      // Find unused code
  | "unused-routes"  // Find unreferenced routes
  | "circular-deps"  // Find circular dependencies
  | "module"         // Module summary
  | "health"         // Project health metrics
  | "feedback"       // Log feedback
  | "ask";           // Multi-step reasoning

export interface BrainQuery {
  intent: BrainIntent;
  target?: string;
  context?: string;
  options?: Record<string, any>;
}

export interface BrainResponse {
  intent: BrainIntent;
  success: boolean;
  data: any;
  toolsUsed: string[];
  confidence: number;
  warnings: string[];
  duration: number;
}

export interface BrainTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute(params: any, memory: BrainMemory): Promise<any>;
}

export interface BrainMemory {
  state: Record<string, any>;
  knowledge: Record<string, any>;
  architecture: Record<string, string>;
  memory: Record<string, string>;
  health: Record<string, any>;
  feedback: FeedbackEntry[];
}

export interface FeedbackEntry {
  id: string;
  timestamp: string;
  task: string;
  solution: string;
  result: string;
  duration: number;
  errors: string[];
  corrections: string[];
  agent: string;
  success: boolean;
}

export interface HealthMetrics {
  generatedAt: string;
  changeId: number;
  buildStatus: "PASSED" | "FAILED" | "UNKNOWN";
  testStatus: string;
  moduleCount: number;
  routeCount: number;
  modelCount: number;
  agentCount: number;
  testCount: number;
  deadCodeCount: number;
  circularDepCount: number;
  unusedRouteCount: number;
  feedbackCount: number;
  feedbackSuccessRate: number;
  overall: "healthy" | "warning" | "critical";
  warnings: string[];
}
