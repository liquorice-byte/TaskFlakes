#!/usr/bin/env bash
# ============================================================
# Phase 3 API Integration Test Script (curl-based)
# Coverage:
#   - Auth PATCH /me (rename) + DELETE /me (account wipe)
#   - Settings GET/PATCH (upsert defaults, partial updates,
#     enum validations, bad hex color rejection)
#   - Stats GET / (overview, bySubject, byType, dailyTrend,
#     weekHeatmap, overdueTop5 shape)
#   - Export GET / (downloads taskflakes-export-*.json)
#   - Import POST /import (merge + replace modes)
#   - End-to-end roundtrip: create seed -> export -> new user ->
#     import merge/replace -> stats reflect the imported data
#
# NOTE: Access token is returned in BODY.data.accessToken by
#       /auth/register & /auth/login, refresh token via cookie.
#       All protected endpoints require Authorization: Bearer <at>.
#
# Usage:  bash backend/scripts/test-phase3.sh [BASE_URL]
# ============================================================

set -u

BASE_URL="${1:-http://localhost:4000}"
API_URL="${BASE_URL}/api"
COOKIE_FILE="/tmp/taskflakes-phase3-cookies.txt"
rm -f "$COOKIE_FILE" /tmp/p3-last.json /tmp/p3-export.json

CURL="curl -sS --connect-timeout 5 --max-time 15"

PASS="✅ PASS"
FAIL="❌ FAIL"
TOTAL=0
PASSED=0
# Access token + Authorization header array — populated after each register/login.
ACCESS_TOKEN=""
AUTH=()

section() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }
sub()     { echo -e "\033[0;36m-- $* --\033[0m"; }

die_backend_down() {
  echo -e "\n\033[1;31m❌ 无法连接到后端 API: $BASE_URL\033[0m"
  echo "请先启动后端：cd backend && npm run dev"
  exit 1
}
die_no_token() {
  echo -e "\n\033[1;31m❌ 无法从响应中解析 ACCESS_TOKEN，终止测试\033[0m"
  echo "最近响应：" >&2
  sed 's/^/    /' /tmp/p3-last.json >&2
  exit 1
}

# ---------- assertion helpers ----------

assert_status() {
  local expected="$1"; local actual="$2"; local test="$3"
  TOTAL=$((TOTAL+1))
  if [[ "$actual" == "$expected" ]]; then
    echo -e "$PASS  [$actual] $test"
    PASSED=$((PASSED+1))
  else
    echo -e "$FAIL  [expected $expected, got $actual] $test" >&2
    echo "  Response body:" >&2
    sed 's/^/    /' /tmp/p3-last.json >&2
  fi
}

_json_get() {
  local path="$1"
  P3_JSON_PATH="$path" node <<'NODE_EOF'
    const fs = require('fs');
    const path = process.env.P3_JSON_PATH || '';
    try {
      const raw = fs.readFileSync('/tmp/p3-last.json', 'utf8');
      const top = JSON.parse(raw);
      const wrapped = top && typeof top === 'object' && 'data' in top;
      const dataRoot = wrapped ? top.data : top;
      if (path === '__IS_ARRAY__') {
        process.stdout.write(Array.isArray(dataRoot) ? 'true' : 'false');
        process.exit(0);
      }
      const parts = path.split('.').filter(Boolean);
      let start = dataRoot;
      if (wrapped && parts[0] === 'meta') start = top;
      let cur = start;
      for (const p of parts) {
        if (cur == null) { break; }
        if (p === 'length' && Array.isArray(cur)) { cur = cur.length; continue; }
        if (p === '__IS_ARRAY__')    { cur = Array.isArray(cur) ? 'true' : 'false'; continue; }
        if (p === '__IS_NULLISH__')  { cur = (cur == null) ? 'true' : 'false'; continue; }
        if (typeof cur !== 'object') { cur = undefined; break; }
        cur = cur[p];
      }
      if (cur === undefined) process.stdout.write('');
      else if (cur === null) process.stdout.write('null');
      else if (typeof cur === 'object') process.stdout.write(JSON.stringify(cur));
      else process.stdout.write(String(cur));
    } catch (e) {
      process.stderr.write('p3 _json_get parse error: ' + e.message + '\n');
      process.exit(2);
    }
NODE_EOF
}

assert_json() {
  local path="$1"; local expected="$2"; local test="$3"
  TOTAL=$((TOTAL+1))
  local actual
  actual=$(_json_get "$path")
  if [[ "$actual" == "$expected" ]]; then
    echo -e "$PASS  $test"
    PASSED=$((PASSED+1))
  else
    echo -e "$FAIL  $test" >&2
    echo "  path '$path': expected '$expected', got '$actual'" >&2
  fi
}

assert_json_contains() {
  local path="$1"; local needle="$2"; local test="$3"
  TOTAL=$((TOTAL+1))
  local actual
  actual=$(_json_get "$path")
  if [[ "$actual" == *"$needle"* ]]; then
    echo -e "$PASS  $test"
    PASSED=$((PASSED+1))
  else
    echo -e "$FAIL  $test" >&2
    echo "  path '$path' does not contain '$needle'. got='$actual'" >&2
  fi
}

# ---------- Extract access token from the current /tmp/p3-last.json body ----------
# Expects the ok() wrapper: {success:true, data:{accessToken:"...", user:{...}}}
extract_access_token() {
  ACCESS_TOKEN=$(
    node <<'NODE_EOF'
const fs=require('fs');
try {
  const t=JSON.parse(fs.readFileSync('/tmp/p3-last.json','utf8'));
  const at = t?.data?.accessToken;
  process.stdout.write(typeof at === 'string' ? at : '');
} catch(e){ process.stdout.write(''); }
NODE_EOF
  )
  if [[ -n "$ACCESS_TOKEN" ]]; then
    AUTH=(-H "Authorization: Bearer ${ACCESS_TOKEN}")
  else
    AUTH=()
  fi
}

# ---------- HTTP wrappers ----------
# Variants:
#   api_req_pub    ... no Bearer auth (login/register/refresh/health)
#   api_req_auth   ... send AUTH=("Authorization: Bearer ...")

api_req_pub() {
  local method="$1"; local path="$2"
  shift 2
  local attempt=0 max_attempts=5 wait=2
  while (( attempt < max_attempts )); do
    local code
    code=$($CURL -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
      -o /tmp/p3-last.json \
      -w "%{http_code}" \
      -X "$method" \
      -H 'Accept: application/json' \
      "$@" \
      "${API_URL}${path}")
    # Retry transparently on 429 rate-limit (register/login)
    if [[ "$code" == "429" ]]; then
      attempt=$((attempt+1))
      sleep "$wait"
      wait=$((wait*2))
      continue
    fi
    echo "$code"
    return 0
  done
  # All retries exhausted, return latest 429
  echo "429"
}

api_req_auth() {
  local method="$1"; local path="$2"
  shift 2
  local attempt=0 max_attempts=4 wait=1
  while (( attempt < max_attempts )); do
    local code
    code=$($CURL -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
      "${AUTH[@]}" \
      -o /tmp/p3-last.json \
      -w "%{http_code}" \
      -X "$method" \
      -H 'Accept: application/json' \
      "$@" \
      "${API_URL}${path}")
    if [[ "$code" == "429" ]]; then
      attempt=$((attempt+1))
      sleep "$wait"
      wait=$((wait*2))
      continue
    fi
    echo "$code"
    return 0
  done
  echo "429"
}

post_pub()   { local p="$1"; local b="$2"; shift 2; api_req_pub  POST "$p" -H 'Content-Type: application/json' -d "$b" "$@"; }
post()       { local p="$1"; local b="$2"; shift 2; api_req_auth POST "$p" -H 'Content-Type: application/json' -d "$b" "$@"; }
get()        { local p="$1"; shift;         api_req_auth GET  "$p" "$@"; }
patch()      { local p="$1"; local b="$2"; shift 2; api_req_auth PATCH "$p" -H 'Content-Type: application/json' -d "$b" "$@"; }
del()        { local p="$1"; local b="$2"; shift 2; api_req_auth DELETE "$p" -H 'Content-Type: application/json' -d "$b" "$@"; }

# ---------- Preflight ----------

section "Preflight: backend health + 注册 + 登录"

if ! $CURL -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" >/dev/null 2>&1; then
  die_backend_down
fi

HEALTH=$($CURL -o /tmp/p3-last.json -w "%{http_code}" "${BASE_URL}/api/health")
assert_status 200 "$HEALTH" "后端健康检查 /api/health"

EMAIL="phase3-$(date +%s)-$$@example.com"
PASSWD='Sup3rS3cret!'
NAME='Phase 3 Test User'

CODE=$(post_pub /auth/register "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWD}\",\"name\":\"${NAME}\"}")
assert_status 201 "$CODE" "注册测试用户 $EMAIL"
extract_access_token
[[ -z "$ACCESS_TOKEN" ]] && die_no_token
# Register response: data.user.email / data.user.name
assert_json "user.email" "$EMAIL" "注册返回 user.email"
assert_json "user.name"  "$NAME"  "注册返回 user.name"
# 注册本身已返回 accessToken，并下发 refresh cookie；无需再登录。
# 校验 GET /auth/me 直接可访问，证明 Bearer token 可用。
CODE=$(get /auth/me)
assert_status 200 "$CODE" "GET /auth/me（注册后直接用 Bearer token 访问）"
assert_json "email" "$EMAIL" "GET /auth/me 返回 email"

# ==============================================================
# 1. Auth 扩展：PATCH /me 重命名 + DELETE /me 保护
# ==============================================================
section "1. PATCH /auth/me & DELETE /auth/me"

CODE=$(patch /auth/me '{"name":"Phase 3 Renamed"}')
assert_status 200 "$CODE" "PATCH /auth/me 修改用户名"
assert_json "name" "Phase 3 Renamed" "PATCH /auth/me 返回新名字"

CODE=$(get /auth/me)
assert_status 200 "$CODE" "GET /auth/me 拉取当前用户"
assert_json "name" "Phase 3 Renamed" "用户数据持久化"

CODE=$(del /auth/me '{"email":"wrong-email@example.com"}')
assert_status 400 "$CODE" "DELETE /me 邮箱不符被拒绝 (400)"

# ==============================================================
# 2. Settings CRUD
# ==============================================================
section "2. Settings GET/PATCH 校验"

CODE=$(get /settings)
assert_status 200 "$CODE" "GET /settings 首次自动 upsert 默认行"
assert_json "theme"         "SYSTEM"  "默认 theme 字段"
assert_json "language"      "ZH_CN"   "默认 language 字段"
assert_json "defaultPriority" "MEDIUM" "默认 defaultPriority"
assert_json "dailyCutoffHour" "22"     "默认 dailyCutoffHour=22"
assert_json "defaultSubjectColor" "#6B7280" "默认 defaultSubjectColor"
assert_json "showCompletedByDefault" "true" "默认 showCompletedByDefault=true"

sub "局部更新 + 枚举验证"
CODE=$(patch /settings '{"theme":"DARK","dailyCutoffHour":4,"defaultPriority":"HIGH"}')
assert_status 200 "$CODE" "PATCH /settings 局部更新多字段"
assert_json "theme" "DARK" "theme 已切换为 DARK"
assert_json "dailyCutoffHour" "4" "dailyCutoffHour 已修改为 4"
assert_json "defaultPriority" "HIGH" "defaultPriority 已修改为 HIGH"
# untouched fields keep previous default
assert_json "language" "ZH_CN" "language 未被局部更新覆盖"

CODE=$(patch /settings '{"theme":"INVALID"}')
assert_status 400 "$CODE" "非法 theme 枚举拒绝 400"

CODE=$(patch /settings '{"dailyCutoffHour":25}')
assert_status 400 "$CODE" "dailyCutoffHour>23 拒绝 400"

CODE=$(patch /settings '{"defaultSubjectColor":"not-a-color"}')
assert_status 400 "$CODE" "非法 hex color 拒绝 400"

CODE=$(patch /settings '{"defaultSubjectColor":"#6366F1","semesterStart":"2025-02-17","showCompletedByDefault":false}')
assert_status 200 "$CODE" "PATCH 设置颜色 + 学期开始 + showCompleted=false"
assert_json "defaultSubjectColor" "#6366F1" "defaultSubjectColor 保存准确值"
assert_json "showCompletedByDefault" "false" "showCompletedByDefault 保存 false"
assert_json_contains "semesterStart" "2025-02-17" "semesterStart 包含指定日期"

# ==============================================================
# 3. Stats GET — 空数据 + 造数据后验证六大模块形状
# ==============================================================
section "3. Stats /api/stats 六大模块结构"

sub "空账户 stats"
CODE=$(get /stats)
assert_status 200 "$CODE" "GET /stats 空账户 200"
assert_json "__IS_ARRAY__" "false" "/stats 根是对象不是数组"
assert_json_contains "overview" "\"total\"" "overview.total 字段存在"
assert_json "overview.total" "0" "空账户 overview.total=0"
assert_json "overview.overdue" "0" "空账户 overview.overdue=0"
assert_json "bySubject.length" "0" "空账户 bySubject=[]"
assert_json "byType.length" "6" "空账户 byType=6 个桶（含 0 值）"
assert_json "dailyTrend.length" "14" "dailyTrend 固定 14 天"
assert_json "weekHeatmap.length" "7" "weekHeatmap 固定 7 格 (周历)"
assert_json "overdueTop5.length" "0" "空账户 overdueTop5=[]"

sub "植入测试数据 (Subject + 多个 Assignment)"
# Create subject
CODE=$(post /subjects '{"name":"微积分","color":"#F59E0B"}')
assert_status 201 "$CODE" "POST /subjects 创建 Subject 微积分"
SUB_CALC_ID=$(_json_get "id")

CODE=$(post /subjects '{"name":"英语写作","color":"#2563EB"}')
assert_status 201 "$CODE" "POST /subjects 创建 Subject 英语写作"
SUB_ENG_ID=$(_json_get "id")

# Date helpers (works on both BSD/date and GNU/date)
TODAY_UTC=$(date -u +%Y-%m-%d)
PAST_1=$(date -u -v-9d +%Y-%m-%d 2>/dev/null || date -u -d '9 days ago' +%Y-%m-%d)
PAST_2=$(date -u -v-5d +%Y-%m-%d 2>/dev/null || date -u -d '5 days ago' +%Y-%m-%d)
PAST_3=$(date -u -v-2d +%Y-%m-%d 2>/dev/null || date -u -d '2 days ago' +%Y-%m-%d)
FUT_1=$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d 'tomorrow'  +%Y-%m-%d)
FUT_3=$(date -u -v+3d +%Y-%m-%d 2>/dev/null || date -u -d '3 days'   +%Y-%m-%d)

create_assignment() {
  local title="$1"; local subject="$2"; local atype="$3"; local priority="$4";
  local due="$5"; local status="$6";
  post /assignments "$(jq -cn \
    --arg t "$title" --arg s "$subject" --arg ty "$atype" --arg pr "$priority" \
    --arg d "$due"   --arg st "$status" \
    '{title:$t, subjectId:$s, type:$ty, priority:$pr, dueDate:$d, status:$st}')"
}

CODE=$(create_assignment "习题 3.4" "$SUB_CALC_ID"  "WRITTEN" "HIGH"   "$PAST_1" "NOT_STARTED")
assert_status 201 "$CODE" "作业 1: 过期 HIGH 书面作业"

CODE=$(create_assignment "Reading Ch 4" "$SUB_ENG_ID" "WATCHING" "MEDIUM" "$PAST_2" "IN_PROGRESS")
assert_status 201 "$CODE" "作业 2: 过期 MEDIUM 视频"

CODE=$(create_assignment "Essay draft" "$SUB_ENG_ID" "WRITING" "MEDIUM" "$PAST_3" "NOT_STARTED")
assert_status 201 "$CODE" "作业 3: 过期 MEDIUM 写作"

CODE=$(create_assignment "期中复习"    "$SUB_CALC_ID" "WRITTEN" "HIGH"   "$TODAY_UTC" "IN_PROGRESS")
assert_status 201 "$CODE" "作业 4: 今日 HIGH"

CODE=$(create_assignment "Preview 5.1" "$SUB_CALC_ID"  "PREVIEW" "LOW" "$FUT_1" "NOT_STARTED")
assert_status 201 "$CODE" "作业 5: 明日 LOW"

CODE=$(create_assignment "Oral test prep" "$SUB_ENG_ID" "ORAL" "HIGH" "$FUT_3" "NOT_STARTED")
assert_status 201 "$CODE" "作业 6: 3天后 HIGH ORAL"

CODE=$(create_assignment "Composite report" "$SUB_ENG_ID" "COMPOSITE" "MEDIUM" "$FUT_3" "DONE")
assert_status 201 "$CODE" "作业 7: 3天后 DONE COMPOSITE"

CODE=$(create_assignment "作业 1.1" "$SUB_CALC_ID" "WRITTEN" "HIGH" "$PAST_2" "DONE")
assert_status 201 "$CODE" "作业 8: 过期且已完成 HIGH (不计入 overdue)"

sub "再拉 stats 验证形状 & 非零结果"
CODE=$(get /stats)
assert_status 200 "$CODE" "GET /stats 有数据账户"
assert_json "overview.total" "8" "overview.total=8"
assert_json "overview.completed" "2" "overview.completed=2"
assert_json "overview.overdue" "3" "overview.overdue=3 (已完成的过期不计入)"
assert_json "overview.highPriority" "3" "overview.highPriority=3 (HIGH 且未完成)"
assert_json "bySubject.length" "2" "bySubject 覆盖 2 个 subjects"
assert_json "byType.length" "6" "byType 应该 6 种类型都有桶 (空值+非空都出现)"
assert_json "dailyTrend.length" "14" "dailyTrend 还是 14 天"
assert_json "weekHeatmap.length" "7" "weekHeatmap 仍然 7 格"
assert_json "overdueTop5.length" "3" "overdueTop5 展示 3 条"
# overdue 第一条应是最早 PAST_1 -> overdueDays max
assert_json "overdueTop5.0.overdueDays" "9" "overdueTop5[0].overdueDays = 9 (最旧)"
assert_json "overdueTop5.0.title" "习题 3.4" "overdueTop5[0].title 正确"

# ==============================================================
# 4. Export / Import roundtrip
# ==============================================================
section "4. Export GET /api/export & Import POST /api/export/import"

sub "下载 export JSON"
CODE=$($CURL "${AUTH[@]}" -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -o /tmp/p3-export.json \
  -w "%{http_code}" \
  -H 'Accept: application/json' \
  "${API_URL}/export")
assert_status 200 "$CODE" "GET /export 200 (attachment)"

# File is plain JSON (ok() wrapper) – parse shape via node
EXP_INFO=$(node <<'NODE_EOF'
  const fs=require('fs');
  try {
    const t=fs.readFileSync('/tmp/p3-export.json','utf8');
    const top=JSON.parse(t);
    const data=top && typeof top==='object' && 'data' in top ? top.data : top;
    const v=data?.version ?? '';
    const sb=Array.isArray(data?.subjects)?data.subjects.length:'not-array';
    const as=Array.isArray(data?.assignments)?data.assignments.length:'not-array';
    const firstSubj=data?.subjects?.[0]?.name ?? '';
    process.stdout.write(`${v}|${sb}|${as}|${firstSubj}`);
  } catch(e){ process.stdout.write('err:'+e.message); }
NODE_EOF
)
EXP_VER=$(echo "$EXP_INFO" | awk -F'|' '{print $1}')
EXP_SB=$(echo "$EXP_INFO"  | awk -F'|' '{print $2}')
EXP_AS=$(echo "$EXP_INFO"  | awk -F'|' '{print $3}')
EXP_SBJ=$(echo "$EXP_INFO" | awk -F'|' '{print $4}')

TOTAL=$((TOTAL+1))
if [[ "$EXP_VER" == "1" ]]; then
  echo -e "$PASS  export.version = 1"
  PASSED=$((PASSED+1))
else
  echo -e "$FAIL  export.version = $EXP_VER (expected 1)" >&2
fi

TOTAL=$((TOTAL+1))
if [[ "$EXP_SB" == "2" ]]; then
  echo -e "$PASS  export.subjects.length = 2"
  PASSED=$((PASSED+1))
else
  echo -e "$FAIL  export.subjects.length = $EXP_SB (expected 2)" >&2
fi

TOTAL=$((TOTAL+1))
if [[ "$EXP_AS" == "8" ]]; then
  echo -e "$PASS  export.assignments.length = 8"
  PASSED=$((PASSED+1))
else
  echo -e "$FAIL  export.assignments.length = $EXP_AS (expected 8)" >&2
fi

sub "Import: merge mode (新建用户 + 合并 + 结果统计)"

EMAIL2="phase3-$(date +%s)-$$-imp@example.com"
# Register + login as another user, re-use cookie file
CODE=$(post_pub /auth/register "{\"email\":\"${EMAIL2}\",\"password\":\"${PASSWD}\",\"name\":\"Import User\"}")
assert_status 201 "$CODE" "注册 import-target 用户"
CODE=$(post_pub /auth/login "{\"email\":\"${EMAIL2}\",\"password\":\"${PASSWD}\"}")
assert_status 200 "$CODE" "登录 import-target 用户"
extract_access_token
[[ -z "$ACCESS_TOKEN" ]] && die_no_token

# Build /import body via node (reads file, wraps with merge mode)
node <<'NODE_EOF'
  const fs=require('fs');
  const file=fs.readFileSync('/tmp/p3-export.json','utf8');
  const top=JSON.parse(file);
  const data=(top && 'data' in top) ? top.data : top;
  const payload={mode:'merge',data};
  fs.writeFileSync('/tmp/p3-import-merge.json',JSON.stringify(payload));
NODE_EOF
CODE=$($CURL "${AUTH[@]}" -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -o /tmp/p3-last.json -w "%{http_code}" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -X POST --data-binary @/tmp/p3-import-merge.json \
  "${API_URL}/export/import")
assert_status 200 "$CODE" "POST /export/import mode=merge"
assert_json "mode" "merge" "import summary.mode = merge"
assert_json "subjectsCreated" "2" "summary.subjectsCreated=2"
assert_json "assignmentsCreated" "8" "summary.assignmentsCreated=8"
assert_json "assignmentsDeleted" "0" "merge 模式 assignmentsDeleted=0"

# Stats for import-target user should now show 8 total
CODE=$(get /stats)
assert_status 200 "$CODE" "merged user stats 200"
assert_json "overview.total" "8" "merged user overview.total=8"
assert_json "overview.overdue" "3" "merged user overview.overdue=3"
assert_json "bySubject.length" "2" "merged user bySubject=2"

sub "Import: replace mode (先再加一笔 + 再 replace，验证先清空再导入)"
# First add one subject "to be wiped" to user 2 so replace has something to delete
CODE=$(post /subjects '{"name":"临时科目","color":"#EF4444"}')
assert_status 201 "$CODE" "import-target 手动再建一门临时科目"
SUB_WIPE_ID=$(_json_get "id")
# Add one assignment to it (so assignmentsDeleted is not trivial 0)
CODE=$(post /assignments "{\"title\":\"临时作业\",\"subjectId\":\"${SUB_WIPE_ID}\",\"type\":\"WRITTEN\",\"priority\":\"LOW\",\"dueDate\":\"${FUT_1}\"}")
assert_status 201 "$CODE" "import-target 手动再建一门临时作业"

CODE=$(get /stats)
assert_json "overview.total" "9" "before replace total=9"
assert_json "bySubject.length" "3" "before replace bySubject=3"

node <<'NODE_EOF'
  const fs=require('fs');
  const file=fs.readFileSync('/tmp/p3-export.json','utf8');
  const top=JSON.parse(file);
  const data=(top && 'data' in top) ? top.data : top;
  const payload={mode:'replace',data};
  fs.writeFileSync('/tmp/p3-import-replace.json',JSON.stringify(payload));
NODE_EOF
CODE=$($CURL "${AUTH[@]}" -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -o /tmp/p3-last.json -w "%{http_code}" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -X POST --data-binary @/tmp/p3-import-replace.json \
  "${API_URL}/export/import")
assert_status 200 "$CODE" "POST /export/import mode=replace"
assert_json "mode" "replace" "summary.mode = replace"
assert_json "subjectsDeleted" "3" "subjectsDeleted=3 (2 imported + 1 临时科目)"
assert_json "assignmentsDeleted" "9" "assignmentsDeleted=9 (8 imported + 1 临时作业)"
assert_json "subjectsCreated" "2" "replace subjectsCreated=2"
assert_json "assignmentsCreated" "8" "replace assignmentsCreated=8"

CODE=$(get /stats)
assert_status 200 "$CODE" "replace-user stats 200"
assert_json "overview.total" "8" "replace 后 total 回到 8"
assert_json "bySubject.length" "2" "replace 后 bySubject=2"

sub "非法 import payload 校验"
CODE=$(post /export/import '{"mode":"replace","data":{"version":1,"subjects":[{"name":"no color"}],"assignments":[]}}')
assert_status 400 "$CODE" "subject 缺 color -> 400 校验失败"

# ==============================================================
# 5. DELETE /me 最终账户清理
# ==============================================================
section "5. DELETE /auth/me 永久删除 + 会话失效"

CODE=$(get /auth/me)
assert_status 200 "$CODE" "确认当前仍为 import-target 用户"

CODE=$(del /auth/me "{\"email\":\"${EMAIL2}\"}")
assert_status 204 "$CODE" "DELETE /me 邮箱匹配返回 204 (无 body)"

CODE=$(get /auth/me)
assert_status 401 "$CODE" "删除后访问 /me 返回 401 (会话失效)"

# ==============================================================
# Summary
# ==============================================================
echo
echo "============= TaskFlakes Phase 3 测试结果 ============="
echo "总用例数: $TOTAL"
echo "通过:     $PASSED"
echo "失败:     $((TOTAL - PASSED))"
echo "======================================================="

if [[ "$PASSED" -eq "$TOTAL" ]]; then
  echo -e "\033[0;32mAll Phase 3 tests passed ✨\033[0m"
  exit 0
else
  echo -e "\033[0;31mSome Phase 3 tests FAILED\033[0m"
  exit 1
fi
