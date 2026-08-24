import parseNotionCsv, { type AssignmentImportRow } from './src/utils/notionCsv';
import fs from 'fs';

async function testCsvImport() {
  try {
    const csvPath = '/Users/graceq/Downloads/ExportBlock-8ea329b6-7f64-4860-9b4e-de3cef8482b9-Part-1/Assignments Tracker 2cd6dba2b708808494bdcc9bb95be28d_all.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Create a File-like object
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'test.csv', { type: 'text/csv' });
    
    const result = await parseNotionCsv(file);
    
    console.log('Subjects found:', result.subjects.length);
    console.log('Subjects:', result.subjects);
    
    console.log('\nAssignments found:', result.assignments.length);
    
    // Test cases from our CSV
    const testCases = [
      { title: '抄写7A古诗文', expectedSubject: 'Chinese', expectedStatus: 'DONE', expectedPriority: 'HIGH' },
      { title: '《这座城, 很美》', expectedSubject: 'Chinese', expectedStatus: 'DONE', expectedParent: '作文' },
      { title: '填选卷', expectedSubject: 'Maths', expectedStatus: 'IN_PROGRESS', expectedPriority: 'LOW' },
      { title: '练习卷-1', expectedSubject: 'English', expectedStatus: 'DONE', expectedParent: '练习卷套装' },
    ];
    
    for (const testCase of testCases) {
      const assignment = result.assignments.find(a => a.title === testCase.title);
      if (assignment) {
        console.log(`\n✓ Found: ${testCase.title}`);
        console.log(`  Subject: ${assignment.subjectName} (expected: ${testCase.expectedSubject})`);
        console.log(`  Status: ${assignment.status} (expected: ${testCase.expectedStatus})`);
        console.log(`  Priority: ${assignment.priority} (expected: ${testCase.expectedPriority})`);
        console.log(`  Parent: ${assignment.parentTitle || 'none'} (expected: ${testCase.expectedParent || 'none'})`);
        console.log(`  Type: ${assignment.type}`);
        console.log(`  Due Date: ${assignment.dueDate}`);
        
        // Verify expectations
        if (assignment.subjectName !== testCase.expectedSubject) {
          console.log(`  ❌ Subject mismatch!`);
        }
        if (assignment.status !== testCase.expectedStatus) {
          console.log(`  ❌ Status mismatch!`);
        }
        if (assignment.priority !== testCase.expectedPriority) {
          console.log(`  ❌ Priority mismatch!`);
        }
        if ((assignment.parentTitle || null) !== (testCase.expectedParent || null)) {
          console.log(`  ❌ Parent mismatch!`);
        }
      } else {
        console.log(`\n❌ Not found: ${testCase.title}`);
      }
    }
    
    // Check for parent-child relationships
    console.log('\n\nParent-child relationships:');
    const assignmentsWithParents = result.assignments.filter(a => a.parentTitle);
    console.log(`Found ${assignmentsWithParents.length} assignments with parents`);
    
    assignmentsWithParents.slice(0, 5).forEach(a => {
      console.log(`  ${a.title} -> parent: ${a.parentTitle}`);
    });
    
  } catch (error) {
    console.error('Error testing CSV import:', error);
    process.exit(1);
  }
}

testCsvImport();