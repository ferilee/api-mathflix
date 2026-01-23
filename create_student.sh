#!/bin/bash

# Create a student
echo "Creating student..."
curl -X POST http://localhost:3001/students \
  -H "Content-Type: application/json" \
  -d '{
    "nisn": "1234567890",
    "full_name": "John Doe",
    "major": "TKJ",
    "grade_level": 10
  }'

echo -e "\n\nDone!"
