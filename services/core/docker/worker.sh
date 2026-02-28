#!/bin/sh

celery -A background.celery_conf worker -l info -n worker.default -Q celery --concurrency="${CELERY_CONCURRENCY:-1}" \
--autoscale="${CELERY_AUTOSCALE:-1,1}"