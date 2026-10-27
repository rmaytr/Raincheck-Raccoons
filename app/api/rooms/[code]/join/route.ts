import { handleJoin } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return handleJoin(request, (await context.params).code);
}
