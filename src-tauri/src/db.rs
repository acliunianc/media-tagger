use crate::hash::{compute_file_hash, detect_file_type};
use crate::models::{ExportData, ExportEntry, ImportResult, MediaFile, SearchQuery, TagInfo};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid data: {0}")]
    InvalidData(String),
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, DbError> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), DbError> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS files (
                hash TEXT PRIMARY KEY,
                path TEXT,
                filename TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                modified_time INTEGER NOT NULL DEFAULT 0,
                file_type TEXT NOT NULL DEFAULT 'other',
                status INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS file_tags (
                file_hash TEXT NOT NULL REFERENCES files(hash) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (file_hash, tag_id)
            );

            CREATE TABLE IF NOT EXISTS hash_cache (
                path TEXT PRIMARY KEY,
                hash TEXT NOT NULL,
                modified_time INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
            CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
            CREATE INDEX IF NOT EXISTS idx_file_tags_hash ON file_tags(file_hash);
            CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);
            ",
        )?;
        Ok(())
    }

    pub fn get_cached_hash(&self, path: &str, modified_time: i64) -> Result<Option<String>, DbError> {
        let result: Option<String> = self
            .conn
            .query_row(
                "SELECT hash FROM hash_cache WHERE path = ?1 AND modified_time = ?2",
                params![path, modified_time],
                |row| row.get(0),
            )
            .optional()?;
        Ok(result)
    }

    pub fn cache_hash(&self, path: &str, hash: &str, modified_time: i64) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO hash_cache (path, hash, modified_time) VALUES (?1, ?2, ?3)",
            params![path, hash, modified_time],
        )?;
        Ok(())
    }

    pub fn upsert_file(
        &self,
        hash: &str,
        path: &str,
        filename: &str,
        size: i64,
        modified_time: i64,
        file_type: &str,
    ) -> Result<(), DbError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO files (hash, path, filename, size, modified_time, file_type, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)
             ON CONFLICT(hash) DO UPDATE SET
                path = excluded.path,
                filename = excluded.filename,
                size = excluded.size,
                modified_time = excluded.modified_time,
                file_type = excluded.file_type,
                status = 1,
                updated_at = excluded.updated_at",
            params![hash, path, filename, size, modified_time, file_type, now],
        )?;
        Ok(())
    }

    pub fn mark_missing_by_path(&self, path: &str) -> Result<(), DbError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "UPDATE files SET status = 0, updated_at = ?1 WHERE path = ?2 AND status = 1",
            params![now, path],
        )?;
        Ok(())
    }

    pub fn mark_all_active_as_missing(&self) -> Result<(), DbError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "UPDATE files SET status = 0, updated_at = ?1 WHERE status = 1",
            params![now],
        )?;
        Ok(())
    }

    pub fn get_file_tags(&self, hash: &str) -> Result<Vec<String>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT t.name FROM tags t
             JOIN file_tags ft ON t.id = ft.tag_id
             WHERE ft.file_hash = ?1
             ORDER BY t.name",
        )?;
        let tags = stmt
            .query_map(params![hash], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(tags)
    }

    pub fn get_file_by_hash(&self, hash: &str) -> Result<Option<MediaFile>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT hash, path, filename, size, modified_time, file_type, status
             FROM files WHERE hash = ?1",
        )?;
        let file = stmt
            .query_row(params![hash], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, i32>(6)?,
                ))
            })
            .optional()?;

        match file {
            Some((hash, path, filename, size, modified_time, file_type, status)) => {
                let tags = self.get_file_tags(&hash)?;
                Ok(Some(MediaFile {
                    hash,
                    path,
                    filename,
                    size,
                    modified_time,
                    file_type,
                    status,
                    tags,
                }))
            }
            None => Ok(None),
        }
    }

    pub fn search_files(&self, query: &SearchQuery) -> Result<Vec<MediaFile>, DbError> {
        let mut conditions = Vec::new();
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(status) = query.status {
            conditions.push(format!("f.status = ?"));
            bind_values.push(Box::new(status));
        }

        if !query.file_types.is_empty() {
            let placeholders: Vec<String> = query
                .file_types
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", bind_values.len() + i + 1))
                .collect();
            for ft in &query.file_types {
                bind_values.push(Box::new(ft.clone()));
            }
            conditions.push(format!("f.file_type IN ({})", placeholders.join(", ")));
        }

        if let Some(min) = query.min_size {
            conditions.push(format!("f.size >= ?"));
            bind_values.push(Box::new(min));
        }

        if let Some(max) = query.max_size {
            conditions.push(format!("f.size <= ?"));
            bind_values.push(Box::new(max));
        }

        if let Some(has_tags) = query.has_tags {
            if has_tags {
                conditions.push(
                    "f.hash IN (SELECT DISTINCT file_hash FROM file_tags)".into(),
                );
            } else {
                conditions.push(
                    "f.hash NOT IN (SELECT DISTINCT file_hash FROM file_tags)".into(),
                );
            }
        }

        let tag_filter = if !query.tags.is_empty() {
            let logic = if query.logic.to_uppercase() == "OR" {
                "OR"
            } else {
                "AND"
            };
            if logic == "AND" {
                Some(format!(
                    "f.hash IN (
                        SELECT ft.file_hash FROM file_tags ft
                        JOIN tags t ON ft.tag_id = t.id
                        WHERE t.name IN ({})
                        GROUP BY ft.file_hash
                        HAVING COUNT(DISTINCT t.name) = {}
                    )",
                    query
                        .tags
                        .iter()
                        .enumerate()
                        .map(|(i, _)| format!("?{}", bind_values.len() + i + 1))
                        .collect::<Vec<_>>()
                        .join(", "),
                    query.tags.len()
                ))
            } else {
                Some(format!(
                    "f.hash IN (
                        SELECT DISTINCT ft.file_hash FROM file_tags ft
                        JOIN tags t ON ft.tag_id = t.id
                        WHERE t.name IN ({})
                    )",
                    query
                        .tags
                        .iter()
                        .enumerate()
                        .map(|(i, _)| format!("?{}", bind_values.len() + i + 1))
                        .collect::<Vec<_>>()
                        .join(", ")
                ))
            }
        } else {
            None
        };

        if let Some(ref tf) = tag_filter {
            for tag in &query.tags {
                bind_values.push(Box::new(tag.clone()));
            }
            conditions.push(tf.clone());
        }

        if !query.query.is_empty() {
            let search = format!("%{}%", query.query);
            conditions.push(format!(
                "(f.filename LIKE ? OR f.path LIKE ? OR f.hash IN (
                    SELECT ft.file_hash FROM file_tags ft
                    JOIN tags t ON ft.tag_id = t.id
                    WHERE t.name LIKE ?
                ))"
            ));
            bind_values.push(Box::new(search.clone()));
            bind_values.push(Box::new(search.clone()));
            bind_values.push(Box::new(search));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT f.hash, f.path, f.filename, f.size, f.modified_time, f.file_type, f.status
             FROM files f
             {}
             ORDER BY f.filename ASC",
            where_clause
        );

        let mut stmt = self.conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::types::ToSql> =
            bind_values.iter().map(|v| v.as_ref()).collect();

        let rows = stmt.query_map(params.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i32>(6)?,
            ))
        })?;

        let mut files = Vec::new();
        for row in rows {
            let (hash, path, filename, size, modified_time, file_type, status) = row?;
            let tags = self.get_file_tags(&hash)?;
            files.push(MediaFile {
                hash,
                path,
                filename,
                size,
                modified_time,
                file_type,
                status,
                tags,
            });
        }
        Ok(files)
    }

    pub fn add_tag(&self, hash: &str, tag_name: &str) -> Result<(), DbError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
            params![tag_name],
        )?;
        let tag_id: i64 = self.conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag_name],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT OR IGNORE INTO file_tags (file_hash, tag_id) VALUES (?1, ?2)",
            params![hash, tag_id],
        )?;
        self.conn.execute(
            "UPDATE files SET updated_at = ?1 WHERE hash = ?2",
            params![now, hash],
        )?;
        Ok(())
    }

    pub fn remove_tag(&self, hash: &str, tag_name: &str) -> Result<(), DbError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "DELETE FROM file_tags WHERE file_hash = ?1 AND tag_id = (
                SELECT id FROM tags WHERE name = ?2
            )",
            params![hash, tag_name],
        )?;
        self.conn.execute(
            "UPDATE files SET updated_at = ?1 WHERE hash = ?2",
            params![now, hash],
        )?;
        Ok(())
    }

    pub fn rename_tag(&self, old_name: &str, new_name: &str) -> Result<(), DbError> {
        self.conn.execute(
            "UPDATE tags SET name = ?1 WHERE name = ?2",
            params![new_name, old_name],
        )?;
        Ok(())
    }

    pub fn delete_tag_global(&self, tag_name: &str) -> Result<(), DbError> {
        self.conn.execute(
            "DELETE FROM tags WHERE name = ?1",
            params![tag_name],
        )?;
        Ok(())
    }

    pub fn batch_delete_tags(&self, tag_names: &[String]) -> Result<usize, DbError> {
        let mut deleted = 0usize;
        for name in tag_names {
            let name = name.trim();
            if name.is_empty() {
                continue;
            }
            let count = self.conn.execute(
                "DELETE FROM tags WHERE name = ?1",
                params![name],
            )?;
            deleted += count;
        }
        Ok(deleted)
    }

    pub fn list_tags(&self) -> Result<Vec<TagInfo>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.name, COUNT(ft.file_hash) as cnt
             FROM tags t
             LEFT JOIN file_tags ft ON t.id = ft.tag_id
             GROUP BY t.id
             ORDER BY t.name",
        )?;
        let tags = stmt
            .query_map([], |row| {
                Ok(TagInfo {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    count: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    pub fn suggest_tags(&self, prefix: &str, limit: i64) -> Result<Vec<String>, DbError> {
        let pattern = format!("{}%", prefix);
        let mut stmt = self.conn.prepare(
            "SELECT name FROM tags WHERE name LIKE ?1 ORDER BY name LIMIT ?2",
        )?;
        let tags = stmt
            .query_map(params![pattern, limit], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(tags)
    }

    pub fn process_file(&self, path: &Path) -> Result<Option<String>, DbError> {
        if !path.exists() {
            if let Some(path_str) = path.to_str() {
                self.mark_missing_by_path(path_str)?;
            }
            return Ok(None);
        }

        let metadata = std::fs::metadata(path)?;
        let modified_time = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let size = metadata.len() as i64;
        let path_str = path.to_string_lossy().to_string();
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let file_type = detect_file_type(path);

        let hash = if let Some(cached) = self.get_cached_hash(&path_str, modified_time)? {
            cached
        } else {
            let h = compute_file_hash(path)?;
            self.cache_hash(&path_str, &h, modified_time)?;
            h
        };

        self.upsert_file(&hash, &path_str, &filename, size, modified_time, &file_type)?;
        Ok(Some(hash))
    }

    pub fn reconcile(&self) -> Result<usize, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT hash, path FROM files WHERE status = 1",
        )?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;

        let mut updated = 0usize;
        for (hash, path) in rows {
            let p = PathBuf::from(&path);
            if !p.exists() {
                self.mark_missing_by_path(&path)?;
                updated += 1;
                continue;
            }

            if let Ok(Some(new_hash)) = self.process_file(&p) {
                if new_hash != hash {
                    updated += 1;
                }
            }
        }

        Ok(updated)
    }

    pub fn export_tag_data(&self) -> Result<ExportData, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT f.hash, f.filename, f.file_type, t.name
             FROM files f
             JOIN file_tags ft ON f.hash = ft.file_hash
             JOIN tags t ON ft.tag_id = t.id
             ORDER BY f.hash, t.name",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;

        let mut map: std::collections::BTreeMap<String, ExportEntry> =
            std::collections::BTreeMap::new();

        for row in rows {
            let (hash, filename, file_type, tag) = row?;
            map.entry(hash.clone())
                .or_insert_with(|| ExportEntry {
                    hash,
                    tags: Vec::new(),
                    filename: Some(filename),
                    file_type: Some(file_type),
                })
                .tags
                .push(tag);
        }

        let empty_tags = self.list_empty_tags()?;

        Ok(ExportData {
            version: 1,
            exported_at: Utc::now().to_rfc3339(),
            app: "MediaTagger".into(),
            entries: map.into_values().collect(),
            empty_tags,
        })
    }

    fn list_empty_tags(&self) -> Result<Vec<String>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT t.name FROM tags t
             LEFT JOIN file_tags ft ON t.id = ft.tag_id
             GROUP BY t.id
             HAVING COUNT(ft.file_hash) = 0
             ORDER BY t.name",
        )?;
        let tags = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(tags)
    }

    fn ensure_tag(&self, tag_name: &str) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
            params![tag_name],
        )?;
        Ok(())
    }

    fn ensure_file_placeholder(
        &self,
        hash: &str,
        filename: &str,
        file_type: &str,
    ) -> Result<(), DbError> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "INSERT OR IGNORE INTO files (hash, path, filename, size, modified_time, file_type, status, created_at, updated_at)
             VALUES (?1, '', ?2, 0, 0, ?3, 0, ?4, ?4)",
            params![hash, filename, file_type, now],
        )?;
        Ok(())
    }

    fn clear_all_tags(&self) -> Result<(), DbError> {
        self.conn.execute("DELETE FROM file_tags", [])?;
        self.conn.execute("DELETE FROM tags", [])?;
        Ok(())
    }

    pub fn import_tag_data(&self, data: &ExportData, replace: bool) -> Result<ImportResult, DbError> {
        if data.version != 1 {
            return Err(DbError::InvalidData(format!(
                "unsupported export version: {}",
                data.version
            )));
        }

        if replace {
            self.clear_all_tags()?;
        }

        let mut imported_entries = 0usize;
        let mut imported_tags = 0usize;
        let mut imported_empty_tags = 0usize;

        for tag in &data.empty_tags {
            let tag = tag.trim();
            if tag.is_empty() {
                continue;
            }
            self.ensure_tag(tag)?;
            imported_empty_tags += 1;
        }

        for entry in &data.entries {
            if entry.hash.is_empty() || entry.tags.is_empty() {
                continue;
            }

            let filename = entry
                .filename
                .as_deref()
                .filter(|s| !s.is_empty())
                .unwrap_or("unknown");
            let file_type = entry
                .file_type
                .as_deref()
                .filter(|s| !s.is_empty())
                .unwrap_or("other");

            self.ensure_file_placeholder(&entry.hash, filename, file_type)?;
            imported_entries += 1;

            for tag in &entry.tags {
                let tag = tag.trim();
                if tag.is_empty() {
                    continue;
                }
                self.add_tag(&entry.hash, tag)?;
                imported_tags += 1;
            }
        }

        Ok(ImportResult {
            imported_entries,
            imported_tags,
            imported_empty_tags,
            mode: if replace {
                "replace".into()
            } else {
                "merge".into()
            },
        })
    }
}
