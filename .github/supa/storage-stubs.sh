#!/usr/bin/env bash
# Storage packages that supa-wasm never reaches, replaced by throwing stubs (stub-packages.cjs) in the
# built checkout before the Perry compile, so they are not compiled into the module (-39% wasm size).
# Local-dev only, NOT an upstream candidate: a stub throws when it is used, so the features below are gone.
#
#   storage-stubs.sh <variant> env          print the environment the variant needs, as KEY=VALUE lines
#   storage-stubs.sh <variant> apply <dir>  stub the variant's packages in the built Storage checkout <dir>
#
# variant: all (default, SUPA_STORAGE_VARIANT) stubs everything below; base stubs nothing.
#
# What goes, the feature it backs and the flag that keeps it unreachable (supa-wasm's environment):
#   aws         @aws-sdk/client-s3, lib-storage, s3-request-presigner, client-s3vectors, @smithy/node-http-handler,
#               @tus/s3-store, aws-sigv4-sign. STORAGE_BACKEND=s3 (the S3 object backend), the TUS S3 store and
#               locker (TUS on the s3 backend), multipart Upload and presigned URLs of that backend, VECTOR_ENABLED
#               (s3vectors client), ICEBERG_ENABLED (aws-sigv4-sign signs the catalog requests).
#               Unaffected: STORAGE_BACKEND=file, TUS on files, and the S3 *protocol* endpoint (/s3, its own sigv4
#               verification; the SDK is only read there for types and one instanceof).
#   swagger     @fastify/swagger, @fastify/swagger-ui: /documentation and /documentation/json. Needs EXPOSE_DOCS=false
#               (EXPOSE_DOCS defaults to true and the stubs throw at registration).
#   pgboss      pg-boss: the job queue, webhooks, lifecycle events, async deletes. Needs PG_QUEUE_ENABLE=false.
#   ratelimit   @fastify/rate-limit: the render image rate limiter. Needs RATE_LIMITER_ENABLED=false (and it only
#               applies with IMAGE_TRANSFORMATION_ENABLED=true).
#   features    the routes behind VECTOR_ENABLED (/vector), ICEBERG_ENABLED (/iceberg), IMAGE_TRANSFORMATION_ENABLED
#               (/render/image) become empty plugins, and the admin routes (served by the admin app only, which
#               server-minimal does not start) an empty module. All three flags are off by default.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)

aws=(@aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner @aws-sdk/client-s3vectors
  @smithy/node-http-handler @tus/s3-store aws-sigv4-sign)
swagger=(@fastify/swagger @fastify/swagger-ui)
pgboss=(pg-boss)
ratelimit=(@fastify/rate-limit)
features=("file:dist/http/routes/vector/index.js=plugin" "file:dist/http/routes/iceberg/index.js=plugin"
  "file:dist/http/routes/render/index.js=plugin" "file:dist/http/routes/admin/index.js=empty")

variant=${1:?variant (all|base)}
case $variant in
  base) specs=() envs=() ;;
  all) specs=("${aws[@]}" "${swagger[@]}" "${pgboss[@]}" "${ratelimit[@]}" "${features[@]}") envs=(EXPOSE_DOCS=false) ;;
  *) echo "unknown variant '$variant' (all|base)" >&2; exit 2 ;;
esac
case ${2:?env|apply} in
  env) [ ${#envs[@]} -eq 0 ] || printf '%s\n' "${envs[@]}" ;;
  apply)
    dir=${3:?storage checkout}
    if [ ${#specs[@]} -eq 0 ]; then echo "storage variant $variant: nothing to stub"; exit 0; fi
    node "$here/stub-packages.cjs" "$dir" "${specs[@]}"
    echo "storage variant $variant applied under $dir" ;;
  *) echo "usage: storage-stubs.sh <variant> env|apply <dir>" >&2; exit 2 ;;
esac
