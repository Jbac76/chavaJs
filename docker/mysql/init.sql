-- MySQL initialization script
-- This runs automatically when the container is first created

-- Create test database
CREATE DATABASE IF NOT EXISTS chava_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges
GRANT ALL PRIVILEGES ON chava_dev.* TO 'chava'@'%';
GRANT ALL PRIVILEGES ON chava_test.* TO 'chava'@'%';
FLUSH PRIVILEGES;

-- Log completion
SELECT 'MySQL initialization complete' AS status;
