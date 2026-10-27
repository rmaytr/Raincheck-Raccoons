import { handleCreate } from "@/lib/server";

export const dynamic = "force-dynamic";
export function POST(request: Request) { return handleCreate(request); }
