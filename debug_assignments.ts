import { db } from './src/db';
import { assignments, students } from './src/db/schema';

async function debug() {
    console.log("--- DEBUG: Assignments ---");
    const allAssignments = await db.select().from(assignments).limit(10);
    allAssignments.forEach(a => {
        console.log(`ID: ${a.id} | Title: ${a.title} | Grade: ${a.target_grade} (${typeof a.target_grade}) | Major: ${a.target_major} (${typeof a.target_major})`);
    });

    console.log("\n--- DEBUG: Students ---");
    const allStudents = await db.select().from(students).limit(5);
    allStudents.forEach(s => {
        console.log(`ID: ${s.id} | Name: ${s.full_name} | Grade: ${s.grade_level} (${typeof s.grade_level}) | Major: ${s.major} (${typeof s.major})`);
    });
}

debug();
