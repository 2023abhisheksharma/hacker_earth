import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return { user };
  });
}
