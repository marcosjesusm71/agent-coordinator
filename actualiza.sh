#!/bin/bash
cd /home/jesus/docker/volumes/agent-coordinator
git fetch origin
git reset --hard origin/main
git pull origin master
bash compila.sh
docker compose down
docker compose up -d --build
