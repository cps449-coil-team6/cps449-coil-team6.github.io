FROM python:3.12

WORKDIR /app

# Copy files into container
COPY ./app /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Expose API port
EXPOSE 5000

# Run FastAPI server
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
