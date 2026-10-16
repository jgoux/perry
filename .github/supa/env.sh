#!/usr/bin/env bash
# Print the Storage environment as KEY=VALUE lines (append to $GITHUB_ENV).
# The JWT secret and both keys are generated per run; nothing here is a real credential.
set -euo pipefail
secret=$(openssl rand -hex 24)
b64() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
sign() {
  local h p s
  h=$(printf '{"alg":"HS256","typ":"JWT"}' | b64)
  p=$(printf '%s' "$1" | b64)
  s=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$secret" -binary | b64)
  printf '%s.%s.%s' "$h" "$p" "$s"
}
service_key=$(sign '{"role":"service_role","iss":"supabase-test","iat":1700000000,"exp":4102444800}')
anon_key=$(sign '{"role":"anon","iss":"supabase-test","iat":1700000000,"exp":4102444800}')
cat <<EOT
AUTH_JWT_SECRET=$secret
PGRST_JWT_SECRET=$secret
SERVICE_KEY=$service_key
ANON_KEY=$anon_key
MULTI_TENANT=false
AUTH_JWT_ALGORITHM=HS256
AUTH_ENCRYPTION_KEY=encryptionkey
SERVER_ADMIN_API_KEYS=apikey
SERVER_HOST=127.0.0.1
STORAGE_BACKEND=file
STORAGE_FILE_ETAG_ALGORITHM=md5
DB_INSTALL_ROLES=true
DB_ALLOW_MIGRATION_REFRESH=true
PG_QUEUE_ENABLE=false
RATE_LIMITER_ENABLED=false
IMAGE_TRANSFORMATION_ENABLED=false
PROMETHEUS_METRICS_ENABLED=false
OTEL_METRICS_ENABLED=false
LOG_LEVEL=info
NODE_ENV=production
EOT
