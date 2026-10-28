import prisma from '../config/db';

const formatDateString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

async function main() {
  const pms = await (prisma as any).contractPMSchedule.findMany({
    where: {
      range: { contains: 'NaN' }
    }
  });

  console.log(`Found ${pms.length} PM schedules with NaN in range.`);
  let updatedCount = 0;

  for (const p of pms) {
    let cleanRange = (p.range || '').replace(/NaN-NaN-NaN/gi, '').replace(/NaN/gi, '').trim();
    if (cleanRange.includes(' | ')) {
      const parts = cleanRange.split(' | ').map((s: string) => s.trim()).filter(Boolean);
      cleanRange = parts.join(' | ');
    } else if (cleanRange.startsWith('|')) {
      cleanRange = cleanRange.replace(/^\|\s*/, '').trim();
    } else if (cleanRange.endsWith('|')) {
      cleanRange = cleanRange.replace(/\s*\|$/, '').trim();
    }

    await (prisma as any).contractPMSchedule.update({
      where: { id: p.id },
      data: { range: cleanRange }
    });
    updatedCount++;
  }

  console.log(`Successfully cleaned ${updatedCount} PM schedule ranges!`);
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
