import { handleGet } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return handleGet(request, (await context.params).code);
}
