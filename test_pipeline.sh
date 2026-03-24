#!/bin/bash

# Pipeline Test Script for "YouTube Video Master"
# Topic: cálculo da matemática
# Duration: 5 minutes (300 seconds)

LOG_FILE="pipeline_test.log"
API_URL="http://localhost:3001/api/ai"

echo "[$(date)] 🚀 Starting Pipeline Test..." | tee -a $LOG_FILE
echo "Topic: cálculo da matemática" | tee -a $LOG_FILE

# 1. Generate Ideas
echo "[$(date)] 🧠 Stage 1: Generating Ideas..." | tee -a $LOG_FILE
IDEAS_RESPONSE=$(curl -s -X POST "$API_URL/ideas" \
  -H "Content-Type: application/json" \
  -d '{"topic": "cálculo da matemática"}')

echo "Ideas received: $IDEAS_RESPONSE" >> $LOG_FILE

# Extract first idea title (using simple grep/sed for speed)
IDEA_TITLE=$(echo $IDEAS_RESPONSE | grep -oP '"title":"\K[^"]+' | head -1)

if [ -z "$IDEA_TITLE" ]; then
  echo "❌ Failed to get ideas. Check pipeline_test.log" | tee -a $LOG_FILE
  exit 1
fi

echo "[$(date)] 👍 Idea Selected: $IDEA_TITLE" | tee -a $LOG_FILE

# 2. Run the Full Pipeline in Background
# We use the generate-video endpoint which now handles script -> audio -> images -> video
echo "[$(date)] 🎬 Stage 2: Running full pipeline in background (Script, Audio, Images, FFmpeg)..." | tee -a $LOG_FILE
echo "Duration requested: 5 minutes" | tee -a $LOG_FILE
echo "This may take several minutes. Follow progress in pipeline_test.log" | tee -a $LOG_FILE

# Start the full generation and pipe the output (binary mp4) to a file
curl -s -X POST "$API_URL/generate-video" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"$IDEA_TITLE\", \"durationMinutes\": 5}" \
  --output "test_output_video.mp4" >> $LOG_FILE 2>&1 &

PID=$!
echo "[$(date)] ⚙️ Pipeline process started with PID: $PID" | tee -a $LOG_FILE
echo "Check 'tail -f $LOG_FILE' for internal logs from NestJS." | tee -a $LOG_FILE
