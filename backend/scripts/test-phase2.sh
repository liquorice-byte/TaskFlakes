#!/usr/bin/env bash
# ============================================================
# Phase 2 API Integration Test Script (curl-based)
# Coverage: Subjects CRUD, Assignments CRUD + filters,
#           sub-tasks, complete/reopen, pagination & sort.
#
# Usage:  bash backend/scripts/test-phase2.sh [BASE_URL]
# ============================================================

set -u

BASE_URL="${1:-http://localhost:4000}"
COOKIE_FILE="/tmp/assignment-tracker-phase2-cookies.txt"
rm -f "$COOKIE_FILE" /tmp/p2-last.json

CURL="curl -sS --connect-timeout 5 --max-time 15"

PASS="✅ PASS"
FAIL="❌ FAIL"
TOTAL=0
PASSED=0
ACCESS_TOKEN=""

section() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }

die_backend_down() {
  echo -e "\n\033[1;31m❌ 无法连接到后端 API: $BASE_URL\033[0m"
  echo "请先启动后端：cd backend && npm run dev"
  exit 1
}

assert_status() {
  local expected="$1"; local actual="$2"; local test="$3"
  TOTAL=$((TOTAL+1))
  if [[ "$actual" == "$expected" ]]; then
    echo -e "$PASS  [$actual] $test"
    PASSED=$((PASSED+1))
  else
    echo -e "$FAIL  [expected $expected, got $actual] $test" >&2
    echo "  Response body:" >&2
    sed 's/^/    /' /tmp/p2-last.json >&2
  fi
}

# Safe dot-path lookup on saved JSON.
# Path examples:
#   subject.name     ->  d.subject.name
#   length           ->  Array.isArray(d) ? d.length : d.length
#   children.length  ->  d.children.length
#   data.length      ->  if top-level has data field already handled by root arg
#   meta.total       ->  d.meta.total
# Deliberately avoids eval / Function so quotation characters in path have no side effects.
_json_get() {
  local path="$1"
  # Pass path via env to avoid argv-index ambiguity between `-e` vs `- < heredoc` modes.
  P2_JSON_PATH="$path" node <<'NODE_EOF'
    const fs = require('fs');
    const path = process.env.P2_JSON_PATH || '';
    try {
      const raw = fs.readFileSync('/tmp/p2-last.json', 'utf8');
      const top = JSON.parse(raw);
      const wrapped = top && typeof top === 'object' && 'data' in top;
      const dataRoot = wrapped ? top.data : top;
      // Special start points:
      //   __IS_ARRAY__     -> is data root an array?
      //   meta.*           -> walk top wrapper (paginated endpoints)
      //   anything else    -> walk data root
      if (path === '__IS_ARRAY__') {
        process.stdout.write(Array.isArray(dataRoot) ? 'true' : 'false');
        process.exit(0);
      }
      const parts = path.split('.').filter(Boolean);
      let start = dataRoot;
      if (wrapped && parts[0] === 'meta') start = top;
      let cur = start;
      for (const p of parts) {
        if (cur == null) { cur = undefined; break; }
        if (p === 'length' && Array.isArray(cur)) { cur = cur.length; continue; }
        if (p === '__IS_ARRAY__')    { cur = Array.isArray(cur) ? 'true' : 'false'; continue; }
        if (p === '__IS_NULLISH__')  { cur = (cur == null) ? 'true' : 'false'; continue; }
        if (typeof cur !== 'object') { cur = undefined; break; }
        cur = cur[p];
      }
      if (cur === undefined) process.stdout.write('__UNDEFINED__');
      else if (cur === null) process.stdout.write('null');
      else                   process.stdout.write(String(cur));
    } catch (e) {
      process.stdout.write('__ERROR__');
    }
NODE_EOF
}

assert_json() {
  local expr="$1"; local expected="$2"; local test="$3"
  local actual=$(_json_get "$expr")
  TOTAL=$((TOTAL+1))
  if [[ "$actual" == "$expected" ]]; then
    echo -e "$PASS  → $test = $actual"
    PASSED=$((PASSED+1))
  else
    echo -e "$FAIL  → $test (expected '$expected', got '$actual')" >&2
  fi
}

# -------- Preflight --------
section "Preflight: 登录用户并获取 Token"
STATUS=$($CURL -o /dev/null -w "%{http_code}" --retry 0 "$BASE_URL/api/health" 2>&1) || true
if [[ "$STATUS" != "200" ]]; then die_backend_down; fi

RAND_EMAIL="phase2-$(date +%s)-$$@example.com"
STATUS=$($CURL -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RAND_EMAIL\",\"password\":\"Test1234\",\"name\":\"Phase2 User\"}" \
  -o /tmp/p2-last.json -w "%{http_code}")
assert_status 201 "$STATUS" "注册新用户 (邮箱: $RAND_EMAIL)"
ACCESS_TOKEN=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.accessToken)}catch(e){process.stdout.write('')}" 2>/dev/null || true)
if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "❌ 无法拿到 Access Token，终止测试"
  exit 1
fi
AUTH=(-H "Authorization: Bearer $ACCESS_TOKEN")

# =============================================================
# 1. Subjects CRUD
# =============================================================
section "1. Subjects CRUD"

# 初始空列表
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/subjects")
assert_status 200 "$STATUS" "GET /subjects (初始空数组)"
assert_json "__IS_ARRAY__" "true" "返回是数组"

# 创建 Chinese (High)
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/subjects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Chinese","color":"#DC2626"}')
assert_status 201 "$STATUS" "POST /subjects create Chinese"
assert_json "name" "Chinese" "subject.name = Chinese"
SUBJ_CHINESE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

# 创建 Maths + English
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/subjects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Maths","color":"#2563EB"}')
assert_status 201 "$STATUS" "POST /subjects create Maths"
SUBJ_MATHS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/subjects" \
  -H "Content-Type: application/json" \
  -d '{"name":"English","color":"#4F46E5"}')
assert_status 201 "$STATUS" "POST /subjects create English"
SUBJ_ENGLISH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

# 重复名字 → 400
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/subjects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Chinese"}')
assert_status 400 "$STATUS" "POST /subjects duplicate name → 400"

# 列表现在有 3 个
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" "$BASE_URL/api/subjects")
assert_status 200 "$STATUS" "GET /subjects (应该有 3 个)"
assert_json "length" "3" "subjects.length = 3"

# 自动选默认颜色（不传 color）
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/subjects" \
  -H "Content-Type: application/json" \
  -d '{"name":"History"}')
assert_status 201 "$STATUS" "POST /subjects 不带 color → 自动选默认"
SUBJ_HISTORY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

# Update name & color
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X PATCH "$BASE_URL/api/subjects/$SUBJ_HISTORY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Geography","color":"#0891B2"}')
assert_status 200 "$STATUS" "PATCH /subjects/:id rename/update color"
assert_json "name" "Geography" "subject.name updated to Geography"
assert_json "color" "#0891B2" "subject.color updated"

# Delete updated subject
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X DELETE "$BASE_URL/api/subjects/$SUBJ_HISTORY")
assert_status 200 "$STATUS" "DELETE /subjects/:id (Geography)"

# 现在列表回到 3
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" "$BASE_URL/api/subjects")
assert_json "length" "3" "删除后 subjects.length 回到 3"

# 越权拿不到：不存在 id → 404
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X GET "$BASE_URL/api/subjects/0000000000000000000000000")
assert_status 404 "$STATUS" "GET /subjects/nope → 404"

# 未认证 → 401
STATUS=$($CURL -o /tmp/p2-last.json -w "%{http_code}" "$BASE_URL/api/subjects")
assert_status 401 "$STATUS" "GET /subjects (no token) → 401"

# =============================================================
# 2. Assignments CRUD
# =============================================================
section "2. Assignments CRUD"

# 创建 3 个 Top-level assignments（对应 Notion 截图里的）
create_assignment() {
  local payload="$1"
  $CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
    -X POST "$BASE_URL/api/assignments" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

STATUS=$(create_assignment "{
  \"title\":\"抄写7A古诗文\",
  \"status\":\"DONE\",
  \"priority\":\"HIGH\",
  \"type\":\"WRITTEN\",
  \"dueDate\":\"2026-09-01T00:00:00.000Z\",
  \"subjectId\":\"$SUBJ_CHINESE\"
}")
assert_status 201 "$STATUS" "创建抄写7A古诗文"
A1=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

STATUS=$(create_assignment "{
  \"title\":\"课外现代文练习卷\",
  \"status\":\"DONE\",
  \"priority\":\"HIGH\",
  \"type\":\"WRITTEN\",
  \"dueDate\":\"2026-09-01T00:00:00.000Z\",
  \"subjectId\":\"$SUBJ_CHINESE\"
}")
assert_status 201 "$STATUS" "创建课外现代文练习卷（父任务）"
A2=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

STATUS=$(create_assignment "{
  \"title\":\"原版书籍阅读\",
  \"status\":\"IN_PROGRESS\",
  \"priority\":\"HIGH\",
  \"type\":\"COMPOSITE\",
  \"dueDate\":\"2026-09-01T00:00:00.000Z\",
  \"subjectId\":\"$SUBJ_ENGLISH\"
}")
assert_status 201 "$STATUS" "创建原版书籍阅读"
A3=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/p2-last.json','utf8')).data.id)" 2>/dev/null || true)

# 列表 topLevelOnly = 3
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true")
assert_status 200 "$STATUS" "GET /assignments?topLevelOnly=true (3 条)"
assert_json "length" "3" "top-level assignments = 3"

# 创建 2 个子任务给 A2（课外现代文练习卷）
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments/$A2/subtasks" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"子任务1: 记叙文\",\"status\":\"DONE\",\"subjectId\":\"$SUBJ_CHINESE\"}")
assert_status 201 "$STATUS" "POST /assignments/:id/subtasks 创建子任务1"

STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments/$A2/subtasks" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"子任务2: 说明文\",\"status\":\"IN_PROGRESS\",\"subjectId\":\"$SUBJ_CHINESE\"}")
assert_status 201 "$STATUS" "POST /assignments/:id/subtasks 创建子任务2"

# 再次读取 A2，children.length = 2
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments/$A2")
assert_status 200 "$STATUS" "GET /assignments/$A2 (父任务)"
assert_json "children.length" "2" "父任务有 2 个 children"

# Reopen A1 完成 → 未完成
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments/$A1/reopen")
assert_status 200 "$STATUS" "POST /assignments/:id/reopen (抄写7A古诗文)"
assert_json "status" "NOT_STARTED" "status 变为 NOT_STARTED"

# Set status = IN_PROGRESS (body shape: { status: Status })
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments/$A1/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}')
assert_status 200 "$STATUS" "POST /assignments/:id/status → IN_PROGRESS"
assert_json "status" "IN_PROGRESS" "status = IN_PROGRESS"

# Complete 完整
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments/$A1/complete")
assert_status 200 "$STATUS" "POST /assignments/:id/complete"
assert_json "status" "DONE" "status = DONE"
assert_json "completedAt.__IS_NULLISH__" "false" "completedAt 已填充"

# 过滤器：status=IN_PROGRESS → 应该只有 1 条 (原版书籍阅读)
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true&status=IN_PROGRESS")
assert_json "length" "1" "status=IN_PROGRESS 只有 1 条 top-level"

# 过滤器：subject=Chinese → 2 条 top-level
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true&subjectId=$SUBJ_CHINESE")
assert_json "length" "2" "subject=Chinese → 2 条"

# 过滤器：priority=HIGH → 3 条
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true&priority=HIGH")
assert_json "length" "3" "priority=HIGH → 3 条"

# search
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true&search=%E5%8F%A4%E8%AF%97%E6%96%87")
assert_json "length" "1" "search='古诗文' → 1 条"

# Pagination: page=1&limit=2 → only 2 of 3
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true&page=1&limit=2")
assert_json "length" "2" "page=1&limit=2 → 2 条/页"
assert_json "meta.total" "3" "meta.total = 3"

# Update A3: 改 priority 为 MEDIUM，dueDate 到今天
TODAY_ISO=$(date -u +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u +%Y-%m-%d)
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X PATCH "$BASE_URL/api/assignments/$A3" \
  -H "Content-Type: application/json" \
  -d "{\"priority\":\"MEDIUM\",\"dueDate\":\"$TODAY_ISO\"}")
assert_status 200 "$STATUS" "PATCH /assignments/:id (原版书籍阅读)"
assert_json "priority" "MEDIUM" "priority = MEDIUM"

# Delete A1
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X DELETE "$BASE_URL/api/assignments/$A1")
assert_status 200 "$STATUS" "DELETE /assignments/:id (抄写7A古诗文)"

# 删完后 top-level 变成 2
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?topLevelOnly=true")
assert_json "length" "2" "删除后 top-level = 2"

# 父任务 A2 删除 → 子任务 cascade 一起删
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X DELETE "$BASE_URL/api/assignments/$A2")
assert_status 200 "$STATUS" "DELETE 父任务 A2 (级联删除子任务)"

# 全部取：topLevelOnly=false & limit=100 → 只剩 A3（子任务都被级联删了）
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  "$BASE_URL/api/assignments?limit=100")
assert_json "length" "1" "级联删除后只剩 1 条 (A3)"

# Create assignment with subjectId = 不存在 → 400
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments" \
  -H "Content-Type: application/json" \
  -d '{"title":"Bad subject","subjectId":"nonexistent123"}')
assert_status 400 "$STATUS" "POST /assignments 引用不存在 subject → 400"

# Create assignment: 空 title → 400 验证失败
STATUS=$($CURL "${AUTH[@]}" -o /tmp/p2-last.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/assignments" \
  -H "Content-Type: application/json" \
  -d '{"title":"   "}')
assert_status 400 "$STATUS" "POST /assignments title 空白 → 400 校验失败"

# =============================================================
# Summary
# =============================================================
echo -e "\n\033[1;35m═══════════════════════════════════════\033[0m"
echo -e " Results: $PASSED / $TOTAL tests passed"
if [[ "$PASSED" == "$TOTAL" ]]; then
  echo -e "\033[1;32m🎉 Phase 2 CRUD API 全部通过！\033[0m"
else
  echo -e "\033[1;31m⚠️  $((TOTAL-PASSED)) 个测试失败，检查上面输出定位问题。\033[0m"
  exit 1
fi
