import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("test1234", 12);

  const teacher = await prisma.user.upsert({
    where: { email: "test@mathboard.local" },
    update: {},
    create: {
      email: "test@mathboard.local",
      name: "Test Lehrer",
      password: passwordHash,
      role: Role.TEACHER,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "schueler@mathboard.local" },
    update: {},
    create: {
      email: "schueler@mathboard.local",
      name: "Test Schüler",
      password: passwordHash,
      role: Role.STUDENT,
    },
  });

  console.log("Seeded users:", { teacher, student });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
