import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function promoteToAdmin(email: string) {
  console.log(`Promoting user ${email} to System Admin...`);

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  await db.update(users)
    .set({ isSystemAdmin: true })
    .where(eq(users.id, user.id));

  console.log(`User ${email} is now a System Admin.`);
  process.exit(0);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx server/scripts/promoteToAdmin.ts <email>");
  process.exit(1);
}

promoteToAdmin(email);

