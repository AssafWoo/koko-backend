-- Add admin user
INSERT INTO users (username, password_hash, role, created_at, updated_at)
VALUES (
  'admin',
  -- Password: 'admin123'
  '$2a$10$X7z3bZ2q3Y4Z5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
); 