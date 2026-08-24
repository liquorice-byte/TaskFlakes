import fs from 'fs';
import path from 'path';

const CSV_PATH = '/Users/graceq/Downloads/ExportBlock-8ea329b6-7f64-4860-9b4e-de3cef8482b9-Part-1/Assignments Tracker 2cd6dba2b708808494bdcc9bb95be28d_all.csv';

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCSVLine(line));
  
  return { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[\s_-]/g, '');
}

function findColumn(headers, keywords) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedKeywords = keywords.map(k => normalizeHeader(k));
  
  for (let i = 0; i < normalizedHeaders.length; i++) {
    for (const keyword of normalizedKeywords) {
      if (normalizedHeaders[i].includes(keyword)) {
        return i;
      }
    }
  }
  return -1;
}

function mapStatus(status) {
  if (!status) return undefined;
  const v = status.trim().toLowerCase();
  if (['notstarted', 'not-started', 'not_started', '未开始', 'backlog', 'none', '无状态', 'todo', 'to-do', 'to_do', '待办', '待开始'].includes(v)) return 'NOT_STARTED';
  if (['inprogress', 'in-progress', 'in_progress', '进行中', 'doing', 'active', 'in progress'].includes(v)) return 'IN_PROGRESS';
  if (['done', '已完成', 'finished', 'complete', 'completed', 'cancelled', 'canceled', '已取消', 'archived', '归档'].includes(v)) return 'DONE';
  return undefined;
}

function mapPriority(priority) {
  if (!priority) return undefined;
  const v = priority.trim().toLowerCase();
  if (['low', '低', '普通', '一般', 'p3', 'no need', 'noneed', 'not needed', 'notneeded'].includes(v)) return 'LOW';
  if (['medium', '中', 'med', 'normal', 'default', 'p2', '⭐️', '⭐️⭐️'].includes(v)) return 'MEDIUM';
  if (['high', '高', '紧急', 'urgent', 'p1', '⭐️⭐️⭐️'].includes(v)) return 'HIGH';
  return undefined;
}

function parseDueDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function cleanNotionReference(str) {
  return str.replace(/\s*\([^)]*\.csv\)\s*$/g, '').trim();
}

function parseSubItems(subItemsStr) {
  if (!subItemsStr) return [];
  return subItemsStr.split(/,\s*/).map(item => cleanNotionReference(item)).filter(Boolean);
}

async function testCSVParsing() {
  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const { headers, rows } = parseCSV(csvContent);
    
    console.log('CSV Headers:', headers);
    console.log(`Total rows: ${rows.length}`);
    
    // Find column indices
    const titleCol = findColumn(headers, ['Assignment', 'Title', 'Name', '标题', '作业名称']);
    const statusCol = findColumn(headers, ['Status', '状态']);
    const priorityCol = findColumn(headers, ['Priority', 'Priority Level', '优先级']);
    const subjectCol = findColumn(headers, ['Subject', '科目', 'Course', '课程']);
    const dueDateCol = findColumn(headers, ['Due', 'Due Date', '截止日期', 'DDL', 'Deadline']);
    const typeCol = findColumn(headers, ['Type', '类型', '作业类型']);
    const parentCol = findColumn(headers, ['Parent', 'Parent item', '父项', '父作业']);
    const subItemCol = findColumn(headers, ['Sub-item', '子项', 'Sub item']);
    
    console.log('\nColumn mappings:');
    console.log(`  Title: ${titleCol} (${headers[titleCol]})`);
    console.log(`  Status: ${statusCol} (${headers[statusCol]})`);
    console.log(`  Priority: ${priorityCol} (${headers[priorityCol]})`);
    console.log(`  Subject: ${subjectCol} (${headers[subjectCol]})`);
    console.log(`  Due Date: ${dueDateCol} (${headers[dueDateCol]})`);
    console.log(`  Type: ${typeCol} (${headers[typeCol]})`);
    console.log(`  Parent: ${parentCol} (${headers[parentCol]})`);
    console.log(`  Sub-item: ${subItemCol} (${headers[subItemCol]})`);
    
    // Parse assignments
    const assignments = [];
    const subjects = new Set();
    
    for (const row of rows) {
      const title = titleCol >= 0 ? row[titleCol]?.trim() : '';
      if (!title) continue;
      
      const status = statusCol >= 0 ? mapStatus(row[statusCol]) : undefined;
      const priority = priorityCol >= 0 ? mapPriority(row[priorityCol]) : undefined;
      const subjectName = subjectCol >= 0 ? row[subjectCol]?.trim() : '';
      const dueDate = dueDateCol >= 0 ? parseDueDate(row[dueDateCol]) : null;
      const type = typeCol >= 0 ? row[typeCol]?.trim() : '';
      
      // Handle parent-child relationships
      let parentTitle = null;
      if (parentCol >= 0 && row[parentCol]) {
        parentTitle = cleanNotionReference(row[parentCol]);
      }
      
      if (subjectName) subjects.add(subjectName);
      
      assignments.push({
        title,
        status,
        priority,
        subjectName: subjectName || null,
        dueDate,
        type,
        parentTitle
      });
    }
    
    console.log(`\nParsed ${assignments.length} assignments`);
    console.log(`Found ${subjects.size} unique subjects: ${Array.from(subjects).join(', ')}`);
    
    // Test specific cases
    const testCases = [
      { 
        title: '抄写7A古诗文', 
        expected: { subject: 'Chinese', status: 'DONE', priority: 'HIGH', parent: null } 
      },
      { 
        title: '《这座城, 很美》', 
        expected: { subject: 'Chinese', status: 'DONE', priority: 'HIGH', parent: '作文' } 
      },
      { 
        title: '填选卷', 
        expected: { subject: 'Maths', status: 'IN_PROGRESS', priority: 'LOW', parent: '练习卷套装' } 
      },
      { 
        title: '练习卷-1', 
        expected: { subject: 'English', status: 'DONE', priority: 'HIGH', parent: '练习卷套装' } 
      },
      {
        title: '口语-01',
        expected: { subject: 'English', status: 'DONE', priority: 'HIGH', parent: '口语练习' }
      }
    ];
    
    console.log('\nTest cases:');
    for (const testCase of testCases) {
      const assignment = assignments.find(a => a.title === testCase.title);
      if (assignment) {
        const { expected } = testCase;
        const results = [];
        
        if (assignment.subjectName === expected.subject) results.push('✓ Subject');
        else results.push(`✗ Subject (${assignment.subjectName} vs ${expected.subject})`);
        
        if (assignment.status === expected.status) results.push('✓ Status');
        else results.push(`✗ Status (${assignment.status} vs ${expected.status})`);
        
        if (assignment.priority === expected.priority) results.push('✓ Priority');
        else results.push(`✗ Priority (${assignment.priority} vs ${expected.priority})`);
        
        if ((assignment.parentTitle || null) === expected.parent) results.push('✓ Parent');
        else results.push(`✗ Parent (${assignment.parentTitle} vs ${expected.parent})`);
        
        console.log(`\n${testCase.title}: ${results.join(', ')}`);
      } else {
        console.log(`\n${testCase.title}: ✗ Not found`);
      }
    }
    
    // Show some examples
    console.log('\nSample assignments:');
    assignments.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.title} | ${a.subjectName} | ${a.status} | ${a.priority} | ${a.dueDate} | parent: ${a.parentTitle || 'none'}`);
    });
    
    // Count parent-child relationships
    const withParents = assignments.filter(a => a.parentTitle);
    console.log(`\nParent-child relationships: ${withParents.length} assignments have parents`);
    
    // Show some parent-child examples
    console.log('\nParent-child examples:');
    const parentExamples = {};
    withParents.slice(0, 5).forEach(a => {
      if (!parentExamples[a.parentTitle]) {
        parentExamples[a.parentTitle] = [];
      }
      parentExamples[a.parentTitle].push(a.title);
    });
    
    for (const [parent, children] of Object.entries(parentExamples)) {
      console.log(`  ${parent} -> ${children.slice(0, 3).join(', ')}${children.length > 3 ? `... (${children.length} total)` : ''}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testCSVParsing();