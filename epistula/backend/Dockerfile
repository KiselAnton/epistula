FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install PostgreSQL client tools for pg_dump/psql used by backup utilities
RUN apt-get update \
	&& DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
	   postgresql-client ca-certificates gzip \
	&& rm -rf /var/lib/apt/lists/*

# Copy main application file
COPY main.py ./

# Copy all subdirectories and their contents
COPY routers/ ./routers/
COPY middleware/ ./middleware/
COPY utils/ ./utils/

# Copy version file
COPY VERSION ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
