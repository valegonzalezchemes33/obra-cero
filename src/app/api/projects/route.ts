import { db } from "@/lib/db";
import { ProjectCreateSchema } from "@/lib/validation";
import { cachedGet, createPost } from "@/lib/crud-factory";

export const GET = cachedGet("projects:list", (organizationId) =>
  db.project.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
);



export const POST = createPost(ProjectCreateSchema, async (body) => {
  const maxResult = await db.$queryRaw<[{ maxNum: number | null }]>`
    SELECT MAX(CAST(SUBSTRING(code, 4) AS INTEGER)) as "maxNum" FROM "Project"
  `;
  const maxNum = maxResult[0]?.maxNum ?? 0;
  const code = `OB-${String(maxNum + 1).padStart(3, "0")}`;

  return db.project.create({
    data: {
      code,
      name: body.name,
      description: body.description,
      address: body.address,
      status: body.status || "planning",
      type: body.type || "obra",
      budget: body.budget || 0,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      clientEmail: body.clientEmail || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      progress: body.progress || 0,
      organizationId: body.organizationId,
    },
  });
}, "/api/projects");
