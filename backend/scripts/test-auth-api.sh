#!/usr/bin/env bash
# ============================================================
# Phase 1 API Integration Test Script (curl-based)
# Usage:
#   1) Start backend:  cd backend && npm run dev
#   2) Run this:      bash backend/scripts/test-auth-api.sh [BASE_URL]
# ============================================================

set -u

BASE_URL="${1:-http://localhost:4000}"
COOKIE_FILE="/tmp/assignment-tracker-cookies.txt"
rm -f "$COOKIE_FILE" /tmp/last-response.json

# ---------------- curl options ----------------
# --connect-timeout 5 : 5 秒 TCP 连接超时（防后端没启动时挂住）
# --max-time 15       : 单请求总上限 15 秒
# -sS                 : 静默模式但输出错误
CURL="curl -sS --connect-timeout 5 --max-time 15"

PASS="✅ PASS"
FAIL="❌ FAIL"
TOTAL=0
PASSED=0

section() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }

die_backend_down() {
  echo -e "\n\033[1;31m❌ 无法连接到后端 API: $BASE_URL\033[0m"
  echo ""
  echo "请先在另一个终端启动后端："
  echo "  cd $(dirname "$0")/.."
  echo "  npx prisma migrate dev --name init   # 首次运行时执行"
  echo "  npm run dev"
  echo ""
  echo "启动后看到以下日志再跑测试脚本："
  echo "  🚀 TaskFlakes API running on port 4000"
  echo ""
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
    if [[ -s /tmp/last-response.json ]]; then
      echo "  Response body:" >&2
      sed 's/^/    /' /tmp/last-response.json >&2
    fi
  fi
}

# ---------- Pre-flight: check backend is UP ----------
section "Pre-flight: 检查后端是否可访问"
if ! STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" --retry 0 "$BASE_URL/api/health" 2>&1); then
  die_backend_down
fi
if [[ -z "$STATUS" ]]; then
  die_backend_down
fi
echo -e "✅ 后端已就绪: $BASE_URL (HTTP $STATUS)"

# ---------- 1. Health Check ----------
section "1. Health Check"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" "$BASE_URL/api/health")
assert_status 200 "$STATUS" "GET /api/health"

# ---------- 2. Validation Error ----------
section "2. Validation (invalid register payload)"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"bad-email","password":"123"}')
assert_status 400 "$STATUS" "POST /api/auth/register with bad payload"

# ---------- 3. Register New User (use random email to avoid conflict on re-run) ----------
section "3. Register new user"
RAND_EMAIL="test-$(date +%s)-$$@example.com"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RAND_EMAIL\",\"password\":\"Test1234\",\"name\":\"Test User\"}")
assert_status 201 "$STATUS" "POST /api/auth/register ($RAND_EMAIL)"

ACCESS_TOKEN=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('/tmp/last-response.json','utf8')).data.accessToken)}catch(e){process.stdout.write('')}" 2>/dev/null || true)
if [[ -n "$ACCESS_TOKEN" ]]; then
  echo "   ↳ Access token received (${#ACCESS_TOKEN} chars)"
else
  echo "   ⚠️  Could not parse access token from response body" >&2
  echo "   Body was:" >&2; sed 's/^/     /' /tmp/last-response.json >&2
fi

# ---------- 4. Register Duplicate Email ----------
section "4. Register duplicate email -> 400"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RAND_EMAIL\",\"password\":\"Test1234\",\"name\":\"Duplicate\"}")
assert_status 400 "$STATUS" "POST /api/auth/register duplicate email"

# ---------- 5. Login ----------
section "5. Login"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RAND_EMAIL\",\"password\":\"Test1234\"}")
assert_status 200 "$STATUS" "POST /api/auth/login correct credentials"

ACCESS_TOKEN=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('/tmp/last-response.json','utf8')).data.accessToken)}catch(e){process.stdout.write('')}" 2>/dev/null || true)

# ---------- 6. Login Wrong Password ----------
section "6. Login wrong password -> 401"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RAND_EMAIL\",\"password\":\"WrongP@ss1\"}")
assert_status 401 "$STATUS" "POST /api/auth/login wrong credentials"

# ---------- 7. GET /me (with Access Token) ----------
section "7. GET /api/auth/me (with valid token) -> 200"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
assert_status 200 "$STATUS" "GET /api/auth/me with valid token"

# ---------- 8. GET /me (NO token) ----------
section "8. GET /api/auth/me (no token) -> 401"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -X GET "$BASE_URL/api/auth/me")
assert_status 401 "$STATUS" "GET /api/auth/me without token"

# ---------- 9. GET /me (INVALID token) ----------
section "9. GET /api/auth/me (invalid token) -> 401"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer not-a-valid-token.at.all")
assert_status 401 "$STATUS" "GET /api/auth/me with invalid token"

# ---------- 10. Logout ----------
section "10. Logout -> 200"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" \
  -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
assert_status 200 "$STATUS" "POST /api/auth/logout"

# ---------- 11. 404 for unknown route ----------
section "11. Unknown route -> 404"
STATUS=$($CURL -o /tmp/last-response.json -w "%{http_code}" "$BASE_URL/api/nonexistent-route")
assert_status 404 "$STATUS" "GET /api/nonexistent-route"

# ---------- Summary ----------
echo -e "\n\033[1;35m═══════════════════════════════════════\033[0m"
echo -e " Results: $PASSED / $TOTAL tests passed"
if [[ "$PASSED" == "$TOTAL" ]]; then
  echo -e "\033[1;32m🎉 All Phase 1 Auth API tests passed!\033[0m"
else
  echo -e "\033[1;31m⚠️  Some tests failed. Check the output above for details.\033[0m"
  exit 1
fi
