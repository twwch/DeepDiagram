#!/bin/bash

# Activate virtual environment
source .venv/bin/activate

# Start the backend server
uvicorn app.main:app --reload
