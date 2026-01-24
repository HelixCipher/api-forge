FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install pydantic-settings


# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check (uses external script) - REMOVED problematic internal healthcheck
# Simplified health check - now only validates endpoints work properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5   CMD python -c "import urllib.request, sys; resp=urllib.request.urlopen('http://localhost:8000/health', timeout=5); sys.exit(0) if resp.getcode()==200 else sys.exit(1)" || exit 1
# Run as application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]