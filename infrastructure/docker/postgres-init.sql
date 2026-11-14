-- pgvector is available in the image; embeddings are stored as vectors-ready
-- JSON today and the extension is enabled for future SQL-side similarity work.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
