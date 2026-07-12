import dotenv from "dotenv";
dotenv.config();

import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("=== USER SESSIONS ===");
  const sessions = await prisma.userSession.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        }
      }
    }
  });
  console.log(JSON.stringify(sessions, null, 2));

  console.log("=== COUNT ===");
  const count = await prisma.userSession.count({
    where: { expiresAt: { gte: new Date() } }
  });
  console.log("Count with gte Date:", count);
  console.log("Current System Date:", new Date().toISOString());
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
