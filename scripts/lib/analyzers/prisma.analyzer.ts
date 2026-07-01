import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const prismaAnalyzer: Analyzer = {
  name: "prisma",
  description: "Analyzes Prisma schema for models, fields, relations, and indexes",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];
    const schemaFile = allFiles.find((f) => f === "prisma/schema.prisma");
    if (!schemaFile) return { type: "prisma", items, relations };

    const content = fs.readFileSync(
      path.resolve(process.cwd(), schemaFile),
      "utf-8"
    );

    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let modelMatch: RegExpExecArray | null;

    while ((modelMatch = modelRegex.exec(content)) !== null) {
      const modelName = modelMatch[1];
      const block = modelMatch[2];

      const fields: Record<string, string>[] = [];
      const fieldRegex = /^\s+(\w+)\s+(\w+(?:\??))\s*(.*)$/gm;
      let fieldMatch: RegExpExecArray | null;

      while ((fieldMatch = fieldRegex.exec(block)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        const extras = fieldMatch[3].trim();

        // Detect relations
        const relationMatch = extras.match(/@relation\((.+?)\)/);
        const isRequired = !fieldType.endsWith("?");
        const cleanType = fieldType.replace("?", "");

        fields.push({
          name: fieldName,
          type: cleanType,
          required: String(isRequired),
          relation: relationMatch ? relationMatch[1] : "",
          attributes: extras,
        });

        // Create relation link if it references another model
        const maybeModel = cleanType;
        if (maybeModel !== "String" && maybeModel !== "Int" && maybeModel !== "Float"
          && maybeModel !== "Boolean" && maybeModel !== "DateTime" && maybeModel !== "Json"
          && maybeModel !== "Decimal" && maybeModel !== "BigInt") {
          relations.push({
            source: `model:${modelName}`,
            target: `model:${maybeModel}`,
            type: fieldType.endsWith("[]") ? "has_many" : "belongs_to",
            metadata: { through: fieldName },
          });
        }
      }

      // Detect indexes
      const indexes: string[] = [];
      const indexRegex = /@@index\s*\(\[(.+?)\]\)/g;
      let indexMatch: RegExpExecArray | null;
      while ((indexMatch = indexRegex.exec(block)) !== null) {
        indexes.push(indexMatch[1]);
      }

      items.push({
        id: `model:${modelName}`,
        type: "model",
        path: schemaFile,
        name: modelName,
        description: `Prisma model: ${modelName}`,
        metadata: { fields, indexes },
        dependencies: [],
      });
    }

    return { type: "prisma", items, relations };
  },
};
