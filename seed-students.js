import fs from 'fs/promises';
import { db } from './api/_hatchable.js';

async function seed() {
  console.log("Loading current database...");
  await db.load();

  console.log("Reading students.json...");
  const data = JSON.parse(await fs.readFile('./data/students.json', 'utf8'));

  const department = data.department;
  const academic_year = data.academic_year;

  let addedCount = 0;
  
  if (!db.data.student_directory) {
    db.data.student_directory = [];
  }

  for (const [yearKey, yearInfo] of Object.entries(data.years)) {
    const year = yearKey.replace('_', ' '); // e.g. "2nd year"
    const semester = yearInfo.semester;
    const batch = yearInfo.batch;

    for (const student of yearInfo.students) {
      const reg = student.register_no;
      const name = student.name;
      
      const existing = db.data.student_directory.find(s => s.register_number === reg);
      if (existing) {
        Object.assign(existing, { name, department, year, semester, batch, academic_year });
      } else {
        db.data.student_directory.push({
          register_number: reg,
          name,
          department,
          year,
          semester,
          batch,
          academic_year
        });
        addedCount++;
      }
    }
  }

  console.log(`Saving database... (Added ${addedCount} new students)`);
  await db.save();
  console.log("Done!");
}

seed().catch(console.error);
