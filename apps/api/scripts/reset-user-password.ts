/**
 * Foydalanuvchi parolini bazada yangilash (bcrypt).
 *
 * Ishlatish (apps/api papkasida):
 *   npx ts-node scripts/reset-user-password.ts <login> <yangi_parol>
 *
 * Misol:
 *   npx ts-node scripts/reset-user-password.ts asadbek YangiParol2026!
 *
 * Talab: .env da DATABASE_URL (yoki Railway shell muhitida env).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const login = String(process.argv[2] || '').trim();
  const newPassword = String(process.argv[3] || '').trim();

  if (!login || !newPassword) {
    console.error(
      'Foydalanish: npx ts-node scripts/reset-user-password.ts <login> <yangi_parol>',
    );
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error('Parol kamida 6 belgi bo‘lishi kerak.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { login },
      select: { id: true, login: true, fullName: true, email: true, status: true },
    });

    if (!user) {
      console.error(`Foydalanuvchi topilmadi: login="${login}"`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log('Parol yangilandi.');
    console.log(`  login:    ${user.login}`);
    console.log(`  ism:      ${user.fullName}`);
    console.log(`  email:    ${user.email || '—'}`);
    console.log(`  status:   ${user.status}`);
    console.log('Foydalanuvchiga yangi parolni xavfsiz kanaldan yetkazing.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
