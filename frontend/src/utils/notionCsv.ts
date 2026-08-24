import Papa from 'papaparse';
import type { Status, Priority, AssignmentType } from '@/services/assignments.api';

export interface SubjectImportRow {
  name: string;
  color: string;
}

export interface AssignmentImportRow {
  title: string;
  status?: Status;
  priority?: Priority;
  type?: AssignmentType;
  dueDate?: string | null;
  dueTime?: string | null;
  subjectName?: string | null;
  notes?: string | null;
  parentTitle?: string | null;
}

const PRESET_COLORS = [
  '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6',
];
const HEX_COLOR = /^#([0-9a-fA-F]{3}){1,2}$/;

// Notion “全部页面”导出时，父项/子项会附加指向其它 csv 文件的引用，形如：
//   作文 (%E4%BD%9C%E6%96%87%2038b6dba2b70880a9b821ebc9962c0b7b.csv)
// 该正则匹配 “ (xxx.csv)”（含前导空格与括号）并将其移除，保留真实标题。
const CSV_REF_RE = /\s*\([^()]*\.csv\)/gi;

/** 移除值中的 Notion 跨页面 CSV 文件引用，返回清理后的值及是否发生过移除 */
function stripCsvRefs(value: string): { value: string; stripped: boolean } {
  if (!value) return { value, stripped: false };
  const cleaned = value.replace(CSV_REF_RE, '').trim();
  return { value: cleaned, stripped: cleaned !== value.trim() };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function normHeader(s: string): string {
  return String(s || '').trim().toLowerCase().replace(/[\s_-]/g, '');
}

function findCol(headers: string[], keywords: string[]): string | undefined {
  const normHeaders = headers.map(normHeader);
  const normKeys = keywords.map(normHeader);
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i]!;
    if (normKeys.some((k) => h.includes(k))) return headers[i];
  }
  return undefined;
}

function mapStatus(raw: string | undefined): Status | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (!v) return undefined;
  if (['notstarted', 'not-started', 'not_started', '未开始', 'backlog', 'none', '无状态', 'todo', 'to-do', 'to_do', '待办', '待开始'].includes(v)) return 'NOT_STARTED';
  if (['inprogress', 'in-progress', 'in_progress', '进行中', 'doing', 'active', 'in progress'].includes(v)) return 'IN_PROGRESS';
  if (['done', '已完成', 'finished', 'complete', 'completed', 'cancelled', 'canceled', '已取消', 'archived', '归档'].includes(v)) return 'DONE';
  return undefined;
}

function mapPriority(raw: string | undefined): Priority | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (!v) return undefined;
  if (['low', '低', '普通', '一般', 'p3', 'no need', 'noneed', 'not needed', 'notneeded'].includes(v)) return 'LOW';
  if (['medium', '中', 'med', 'normal', 'default', 'p2', '⭐️', '⭐️⭐️'].includes(v)) return 'MEDIUM';
  if (['high', '高', '紧急', 'urgent', 'p1', '⭐️⭐️⭐️'].includes(v)) return 'HIGH';
  return undefined;
}

function mapType(raw: string | undefined): AssignmentType | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (!v) return undefined;
  if (v.includes('书面') || v === 'written') return 'WRITTEN';
  if (v.includes('写作') || v === 'essay' || v.includes('报告') || v === 'writing') return 'WRITING';
  if (v.includes('视频') || v === 'video' || v.includes('观看') || v === 'watching') return 'WATCHING';
  if (v.includes('预习') || v === 'preview' || v.includes('阅读')) return 'PREVIEW';
  if (v.includes('口述') || v === 'oral' || v.includes('口语')) return 'ORAL';
  if (v === 'composite' || v === 'mixed' || v.includes('综合') || v.includes('其它') || v.includes('其他')) return 'COMPOSITE';
  return 'COMPOSITE';
}

function parseDueDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function parseDueTime(dueDateRaw: string | undefined, dueTimeRaw: string | undefined): string | null {
  const datePart = parseDueDate(dueDateRaw);
  if (!datePart) return null;
  const timeStr = String(dueTimeRaw || '').trim();
  if (!timeStr) return null;
  try {
    const combined = new Date(`${datePart}T${timeStr}`);
    if (Number.isNaN(combined.getTime())) return null;
    return combined.toISOString();
  } catch {
    return null;
  }
}

export default function parseNotionCsv(
  file: File
): Promise<{ subjects: SubjectImportRow[]; assignments: AssignmentImportRow[]; csvRefsStripped: number }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data || [];
          const rawHeaders = results.meta.fields || [];

          const subjectCol = findCol(rawHeaders, ['Subject', '科目', 'Course', '课程']);
          const colorCol = findCol(rawHeaders, ['Color', '颜色']);
          const titleCol = findCol(rawHeaders, ['Name', 'Title', '标题', '作业名称', 'Assignment']);
          const statusCol = findCol(rawHeaders, ['Status', '状态']);
          const priorityCol = findCol(rawHeaders, ['Priority', '优先级', 'Priority Level']);
          const typeCol = findCol(rawHeaders, ['Type', '类型', '作业类型']);
          const dueDateCol = findCol(rawHeaders, ['Due', 'Due Date', '截止日期', 'DDL', 'Deadline']);
          const dueTimeCol = findCol(rawHeaders, ['Due Time', '截止时间']);
          const notesCol = findCol(rawHeaders, ['Description', 'Notes', '备注', '描述']);
          const parentCol = findCol(rawHeaders, ['Parent', 'Parent item', '父项', '父作业']);
          const subItemCol = findCol(rawHeaders, ['Sub-item', '子项', 'Sub item']);

          const subjectSet = new Map<string, SubjectImportRow>();
          const assignments: AssignmentImportRow[] = [];
          // 统计被自动移除的 Notion 跨页面 CSV 文件引用次数
          let csvRefsStripped = 0;

          // Build a title-to-assignments map to handle parent references
          const titleToAssignments = new Map<string, AssignmentImportRow[]>();

          for (const row of rows) {
            const titleVal = titleCol ? String(row[titleCol] ?? '').trim() : '';
            if (!titleVal) continue;

            const subjectNameVal = subjectCol ? String(row[subjectCol] ?? '').trim() : '';
            if (subjectNameVal && !subjectSet.has(subjectNameVal)) {
              let color = colorCol ? String(row[colorCol] ?? '').trim() : '';
              if (!color || !HEX_COLOR.test(color)) {
                const idx = hashStr(subjectNameVal) % PRESET_COLORS.length;
                color = PRESET_COLORS[idx] ?? '#8b5cf6';
              }
              subjectSet.set(subjectNameVal, { name: subjectNameVal, color });
            }

            const status = statusCol ? mapStatus(row[statusCol]) : undefined;
            const priority = priorityCol ? mapPriority(row[priorityCol]) : undefined;
            const type = typeCol ? mapType(row[typeCol]) : undefined;
            const dueDate = dueDateCol ? parseDueDate(row[dueDateCol]) : null;
            const dueTime = dueDateCol || dueTimeCol ? parseDueTime(
              dueDateCol ? row[dueDateCol] : undefined,
              dueTimeCol ? row[dueTimeCol] : undefined
            ) : null;
            const notes = notesCol ? (String(row[notesCol] ?? '').trim() || null) : null;
            
            // Handle parent-child relationships from "Parent item" column or "Sub-item" column
            let parentTitle: string | null = null;

            if (parentCol) {
              const parentVal = String(row[parentCol] ?? '').trim();
              if (parentVal) {
                // 移除 Notion 跨页面导出附加的 “ (filename.csv)” 文件引用
                const r = stripCsvRefs(parentVal);
                parentTitle = r.value || null;
                if (r.stripped) csvRefsStripped++;
              }
            }

            assignments.push({
              title: titleVal,
              status,
              priority,
              type,
              dueDate,
              dueTime,
              subjectName: subjectNameVal || null,
              notes,
              parentTitle,
            });
          }
          
          // Handle Sub-item column to establish parent-child relationships
          if (subItemCol) {
            // Build a map of titles to assignments for quick lookup
            const assignmentMap = new Map<string, AssignmentImportRow[]>();
            for (const a of assignments) {
              if (!assignmentMap.has(a.title)) {
                assignmentMap.set(a.title, []);
              }
              assignmentMap.get(a.title)!.push(a);
            }
            
            // Process sub-items
            for (const row of rows) {
              const titleVal = titleCol ? String(row[titleCol] ?? '').trim() : '';
              if (!titleVal) continue;
              
              const subItemsVal = subItemCol ? String(row[subItemCol] ?? '').trim() : '';
              if (!subItemsVal) continue;
              
              // Parse sub-items: they're comma-separated, may carry CSV file references
              const subItems = subItemsVal
                .split(/,\s*/)
                .map((s) => {
                  const r = stripCsvRefs(s);
                  if (r.stripped) csvRefsStripped++;
                  return r.value;
                })
                .filter(Boolean);
              
              // Find the parent assignment
              const parentAssignments = assignmentMap.get(titleVal);
              if (parentAssignments) {
                for (const parent of parentAssignments) {
                  if (!parent.parentTitle) { // Only set children for top-level items
                    // For each sub-item, find its corresponding assignment and set parentTitle
                    for (const subItemTitle of subItems) {
                      const subAssignments = assignmentMap.get(subItemTitle);
                      if (subAssignments) {
                        for (const sub of subAssignments) {
                          if (!sub.parentTitle) {
                            sub.parentTitle = parent.title;
                          }
                        }
                      }
                    }
                  }
                }
              }
             }
           }

           const subjects = Array.from(subjectSet.values());
           resolve({ subjects, assignments, csvRefsStripped });
         } catch (err) {
           reject(err);
         }
      },
      error: (err) => reject(err),
    });
  });
}
