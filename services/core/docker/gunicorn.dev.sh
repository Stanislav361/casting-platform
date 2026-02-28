#!/bin/sh

echo "Starting Gunicorn..."
gunicorn -c gunicorn.conf.py main.main_dev:app