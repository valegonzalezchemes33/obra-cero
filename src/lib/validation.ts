import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional(),
  type: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
});

export const TaskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
});

export const TransactionCreateSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01),
  projectId: z.string().optional(),
  supplierId: z.string().optional(),
  method: z.string().optional(),
  recurring: z.string().optional(),
  date: z.string().optional(),
});

export const MaterialCreateSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  unit: z.string().optional(),
  unitCost: z.coerce.number().optional(),
  unitPrice: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),
  minStock: z.coerce.number().optional(),
  maxStock: z.coerce.number().optional(),
  location: z.string().optional(),
  supplierId: z.string().optional(),
});

export const SupplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  taxId: z.string().optional(),
  category: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

export const TaskUpdateSchema = TaskCreateSchema.partial();

export const MaterialUpdateSchema = MaterialCreateSchema.partial();

export const SchedulerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  config: z.any().optional(),
  cron: z.string().min(1),
  enabled: z.boolean().optional(),
  nextRun: z.string().optional(),
});

export const SchedulerPatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  type: z.string().min(1).optional(),
  config: z.any().optional(),
  cron: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  nextRun: z.string().optional(),
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial();

export const AutomationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  trigger: z.string().min(1),
  condition: z.string().optional(),
  action: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const StockMovementCreateSchema = z.object({
  type: z.enum(["incoming", "outgoing", "adjustment"]),
  quantity: z.coerce.number().min(0.001),
  unitCost: z.coerce.number().optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
  supplierId: z.string().optional(),
  projectId: z.string().optional(),
  date: z.string().optional(),
});

export const WorkflowCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  trigger: z.string().optional(),
  triggerConfig: z.any().optional(),
  enabled: z.boolean().optional(),
  steps: z.array(z.any()).optional(),
});

export const WorkflowUpdateSchema = WorkflowCreateSchema.partial();

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Datos inválidos", details: result.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}

export async function parseBody<T>(req: NextRequest, schema: z.ZodSchema<T>):
  Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json();
    return validateBody(schema, body);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON inválido en el body" }, { status: 400 }),
    };
  }
}
