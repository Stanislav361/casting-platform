#!/bin/bash
set -e

if [[ -z "$ENV_SECRET_KEY" ]]; then
  echo "❌ ENV_SECRET_KEY is not set"
  exit 1
fi

ENV_NAME_RAW=$1
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

env_file="$env_dir/.env"
enc_file="$env_dir/.env.enc"

if [[ ! -f "$env_file" ]]; then
  echo "⚠️ $env_file not found, skipping encryption"
else
  if [[ ! -f "$enc_file" || "$env_file" -nt "$enc_file" ]]; then
    echo "🔐 Encrypting $env_file → $enc_file"
    openssl enc -aes-256-cbc -pbkdf2 -salt \
      -in "$env_file" \
      -out "$enc_file" \
      -pass env:ENV_SECRET_KEY
    echo "✅ Encrypted $env_file → $enc_file"
  else
    echo "ℹ️ $enc_file is up to date, skipping encryption"
  fi
fi


service_accounts_dir="$env_dir/service_accounts"
if [[ ! -d "$service_accounts_dir" ]]; then
  echo "⚠️ Directory $service_accounts_dir not found, skipping service accounts encryption"
else
  for file in "$service_accounts_dir"/*; do
    if [[ -d "$file" || "$file" == *.enc ]]; then
      continue
    fi
    enc_file="${file}.enc"
    if [[ ! -f "$enc_file" || "$file" -nt "$enc_file" ]]; then
      echo "🔐 Encrypting $file → $enc_file"
      openssl enc -aes-256-cbc -pbkdf2 -salt \
        -in "$file" \
        -out "$enc_file" \
        -pass env:ENV_SECRET_KEY
      echo "✅ Encrypted $file → $enc_file"
    else
      echo "ℹ️ $enc_file is up to date, skipping encryption"
    fi
  done
fi

postgres_backup_keys_dir="$env_dir/postgres/backup_keys"
if [[ ! -d "$postgres_backup_keys_dir" ]]; then
  echo "⚠️ Directory $postgres_backup_keys_dir not found, skipping service accounts encryption"
else
  for file in "$postgres_backup_keys_dir"/*; do
    if [[ -d "$file" || "$file" == *.enc ]]; then
      continue
    fi
    enc_file="${file}.enc"
    if [[ ! -f "$enc_file" || "$file" -nt "$enc_file" ]]; then
      echo "🔐 Encrypting $file → $enc_file"
      openssl enc -aes-256-cbc -pbkdf2 -salt \
        -in "$file" \
        -out "$enc_file" \
        -pass env:ENV_SECRET_KEY
      echo "✅ Encrypted $file → $enc_file"
    else
      echo "ℹ️ $enc_file is up to date, skipping encryption"
    fi
  done
fi