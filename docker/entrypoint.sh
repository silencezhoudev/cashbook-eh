#!/bin/sh
echo "============================================="
echo "欢迎使用 Cashbook"
echo "============================================="
# 打印环境信息
# echo "Checking and creating database if it does not exist..."
echo "Starting application with Prisma database initialization..."
if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations 2>/dev/null)" ]; then
  echo "Prisma migrations found. Running migrate deploy..."
  if npx prisma migrate deploy; then
    echo "Success: prisma migrate deploy."
  else
    echo "migrate deploy failed. Attempting to resolve (P3009/drift) by marking migrations as applied..."
    for d in /app/prisma/migrations/*; do
      [ -d "$d" ] || continue
      mig=$(basename "$d")
      echo "Marking migration as applied: $mig"
      npx prisma migrate resolve --applied "$mig" || true
    done
    echo "Syncing schema with prisma db push..."
    npx prisma db push --accept-data-loss
    echo "Schema synced with prisma db push."
  fi
else
  echo "No Prisma migrations found. Running prisma db push to sync schema..."
  npx prisma db push --accept-data_loss
  echo "Success: prisma db push."
fi

# 启动应用程序
echo "Starting application..."
exec node server/index.mjs