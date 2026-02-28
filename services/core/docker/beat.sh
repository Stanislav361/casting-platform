#!/bin/sh

celery -A background.celery_conf beat -l info