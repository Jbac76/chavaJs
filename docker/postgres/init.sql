-- PostgreSQL initialization script
-- This runs automatically when the container is first created

-- Create test database
CREATE DATABASE chava_test;
GRANT ALL PRIVILEGES ON DATABASE chava_test TO chava;

-- Enable useful extensions
\c chava_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c chava_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Log completion
SELECT 'PostgreSQL initialization complete' AS status;
