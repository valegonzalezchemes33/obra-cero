import type { BrainTool, BrainMemory } from "../types";

export abstract class BaseTool implements BrainTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: Record<string, any>;

  abstract execute(params: any, memory: BrainMemory): Promise<any>;

  protected requireParams(params: any, required: string[]): void {
    for (const p of required) {
      if (params[p] === undefined || params[p] === null) {
        throw new Error(`Missing required parameter: ${p}`);
      }
    }
  }
}
