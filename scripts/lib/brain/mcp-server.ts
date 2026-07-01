import * as http from "http";
import { initBrain, query, getToolNames } from "./core";

const PORT = parseInt(process.env.BRAIN_PORT || "3721", 10);

// ── MCP Protocol Types ──

interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

// ── MCP Server ──

export function startMcpServer(port: number = PORT): void {
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/tools") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        tools: getToolNames().map((name) => ({
          name,
          description: name,
          inputSchema: { type: "object", properties: {} },
        })),
      }));
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", port }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let mcpReq: McpRequest;
      try {
        mcpReq = JSON.parse(body);
      } catch {
        sendError(res, null, -32700, "Parse error");
        return;
      }

      try {
        const result = await handleRequest(mcpReq);
        sendResult(res, mcpReq.id, result);
      } catch (err: any) {
        sendError(res, mcpReq.id, -32603, err.message || "Internal error");
      }
    });
  });

  server.listen(port, () => {
    console.log(`[brain-mcp] MCP server running on http://localhost:${port}`);
    console.log(`[brain-mcp] Tools: ${getToolNames().join(", ")}`);
  });
}

async function handleRequest(req: McpRequest): Promise<any> {
  switch (req.method) {
    case "initialize":
      return { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "obraCero-brain", version: "1.0.0" } };

    case "tools/list":
      return {
        tools: getToolNames().map((name) => ({
          name,
          description: `Brain tool: ${name}`,
          inputSchema: {
            type: "object",
            properties: {
              target: { type: "string", description: "Target for the query" },
              context: { type: "string", description: "Additional context" },
              options: { type: "object", description: "Tool-specific options" },
            },
          },
        })),
      };

    case "tools/call": {
      const toolName = req.params?.name;
      const args = req.params?.arguments || {};

      // Route to the unified brain query based on tool name
      const intentMap: Record<string, string> = {
        get_context: "context",
        search: "search",
        analyze_impact: "analyze",
        plan_feature: req.params?.arguments?.mode === "design" ? "design" : "plan",
        summarize_module: "module",
        explain_architecture: "architecture",
        project_health: "health",
        feedback: "feedback",
        query: "query",
        ask: "ask",
      };

      const intent = intentMap[toolName] || "query";
      const response = await query({
        intent: intent as any,
        target: args.target || args.query || args.feature || args.path || "",
        context: args.context || "",
        options: { ...args, mode: args.mode },
      });

      return {
        content: [{
          type: "text",
          text: typeof response.data === "string"
            ? response.data
            : JSON.stringify(response.data, null, 2),
        }],
        isError: !response.success,
        meta: {
          toolsUsed: response.toolsUsed,
          confidence: response.confidence,
          warnings: response.warnings,
          duration: response.duration,
        },
      };
    }

    default:
      throw new Error(`Unknown method: ${req.method}`);
  }
}

function sendResult(res: http.ServerResponse, id: any, result: any): void {
  const mcpRes: McpResponse = { jsonrpc: "2.0", id, result };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(mcpRes));
}

function sendError(res: http.ServerResponse, id: any, code: number, message: string): void {
  const mcpRes: McpResponse = { jsonrpc: "2.0", id, error: { code, message } };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(mcpRes));
}

// ── CLI start ──

if (require.main === module) {
  initBrain().then(() => startMcpServer(PORT));
}
