#!/bin/bash
set -euo pipefail

if [[ -z "${ENV_SECRET_KEY:-}" ]]; then
  echo "❌ ENV_SECRET_KEY is not set"
  exit 1
fi

ENV_NAME_RAW=${1:-}
if [[ -z "$ENV_NAME_RAW" ]]; then
  echo "❌ Provide environment name as first argument (DEV, PROD, LOCAL)"
  exit 1
fi

ENV_NAME=$(echo "$ENV_NAME_RAW" | tr '[:upper:]' '[:lower:]')

case "$ENV_NAME" in
  dev) env_dir="development" ;;
  prod) env_dir="production" ;;
  local) env_dir="local" ;;
  *) env_dir="$ENV_NAME" ;;
esac

echo "ℹ️ Using env_dir: $env_dir"

# --- Функция безопасной расшифровки ---
decrypt_file() {
  local enc_file="$1"
  local orig_file="$2"

  if [[ ! -f "$enc_file" ]]; then
    echo "⚠️ $enc_file not found, skipping"
    return
  fi

  if [[ ! -f "$orig_file" || "$enc_file" -nt "$orig_file" ]]; then
    echo "🔐 Decrypting $enc_file → $orig_file"
    openssl enc -aes-256-cbc -pbkdf2 -d \
      -in "$enc_file" \
      -out "$orig_file" \
      -pass env:ENV_SECRET_KEY || {
        echo "❌ Failed to decrypt $enc_file. Check ENV_SECRET_KEY!"
        exit 1
      }
    echo "✅ Decrypted $enc_file → $orig_file"
  else
    echo "ℹ️ $orig_file is up to date, skipping"
  fi
}

# --- Расшифровка .env ---
decrypt_file "$env_dir/.env.enc" "$env_dir/.env"

# --- Расшифровка service_accounts/*.enc ---
service_accounts_dir="$env_dir/service_accounts"
if [[ -d "$service_accounts_dir" ]]; then
  for enc_file in "$service_accounts_dir"/*.enc; do
    [[ -f "$enc_file" ]] || continue
    decrypt_file "$enc_file" "${enc_file%.enc}"
  done
else
  echo "⚠️ Directory $service_accounts_dir not found, skipping service accounts"
fi

# --- Расшифровка postgres_backup_keys/*.enc ---
postgres_backup_keys_dir="$env_dir/postgres/backup_keys"
if [[ -d "$postgres_backup_keys_dir" ]]; then
  for enc_file in "$postgres_backup_keys_dir"/*.enc; do
    [[ -f "$enc_file" ]] || continue
    decrypt_file "$enc_file" "${enc_file%.enc}"
  done
else
  echo "⚠️ Directory $postgres_backup_keys_dir not found, skipping postgres backup keys"
fi