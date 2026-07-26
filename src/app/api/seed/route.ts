import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { seedUser } from "@/lib/seed";

// POST /api/seed - seeds the logged-in user with demo cards + transactions
// and runs detection. Safe to call multiple times (idempotent).
export async function POST() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const result = await seedUser(user.id);
    return { seeded: true, ...result };
  });
}
