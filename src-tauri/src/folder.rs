use crate::models::FolderNode;
use rusqlite::Connection;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use crate::db::DbError;

fn parent_dir(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

fn folder_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string()
}

fn paths_equal(a: &str, b: &str) -> bool {
    a.trim_end_matches(['\\', '/'])
        .eq_ignore_ascii_case(b.trim_end_matches(['\\', '/']))
}

pub fn path_in_folder(file_path: &str, folder_path: &str) -> bool {
    let folder = folder_path.trim_end_matches(['\\', '/']);
    if folder.is_empty() {
        return true;
    }
    if !file_path.starts_with(folder) {
        return false;
    }
    if file_path.len() == folder.len() {
        return false;
    }
    matches!(
        file_path.as_bytes().get(folder.len()),
        Some(b'\\') | Some(b'/')
    )
}

fn is_drive_root(path: &str) -> bool {
    let trimmed = path.trim_end_matches(['\\', '/']);
    if trimmed.is_empty() {
        return false;
    }
    if trimmed.len() <= 3 && trimmed.contains(':') {
        return true;
    }
    Path::new(trimmed)
        .parent()
        .and_then(|p| p.to_str())
        .map(|s| s.is_empty())
        .unwrap_or(false)
}

fn list_scan_roots(conn: &Connection) -> Result<Vec<String>, DbError> {
    let mut stmt = conn.prepare("SELECT path FROM scan_roots ORDER BY path")?;
    let roots = stmt
        .query_map([], |row| row.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    Ok(roots)
}

pub fn build_folder_tree(conn: &Connection) -> Result<Vec<FolderNode>, DbError> {
    let mut stmt = conn.prepare("SELECT path FROM files WHERE path != ''")?;
    let paths: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    if paths.is_empty() {
        return Ok(vec![]);
    }

    let scan_roots = list_scan_roots(conn)?;

    let mut folder_paths: BTreeSet<String> = BTreeSet::new();
    for path in &paths {
        let mut current = Path::new(path).parent();
        while let Some(dir) = current {
            let Some(s) = dir.to_str() else {
                break;
            };
            if s.is_empty() {
                break;
            }
            folder_paths.insert(s.to_string());
            if scan_roots.iter().any(|root| paths_equal(s, root)) {
                break;
            }
            current = dir.parent();
        }
    }

    let mut children_map: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for folder in &folder_paths {
        if let Some(parent) = parent_dir(folder) {
            if folder_paths.contains(&parent) {
                children_map.entry(parent).or_default().push(folder.clone());
            }
        }
    }

    for children in children_map.values_mut() {
        children.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    }

    fn build_node(
        path: &str,
        children_map: &BTreeMap<String, Vec<String>>,
        all_paths: &[String],
    ) -> FolderNode {
        let file_count = all_paths
            .iter()
            .filter(|p| path_in_folder(p, path))
            .count() as u32;
        let children = children_map
            .get(path)
            .map(|kids| {
                kids.iter()
                    .map(|k| build_node(k, children_map, all_paths))
                    .collect()
            })
            .unwrap_or_default();

        FolderNode {
            path: path.to_string(),
            name: folder_name(path),
            file_count,
            children,
        }
    }

    let tree_roots: Vec<String> = if !scan_roots.is_empty() {
        scan_roots
            .into_iter()
            .filter(|root| {
                folder_paths.iter().any(|f| paths_equal(f, root))
                    || paths.iter().any(|p| path_in_folder(p, root))
            })
            .collect()
    } else {
        let mut inferred: BTreeSet<String> = folder_paths.clone();
        for folder in &folder_paths {
            if let Some(parent) = parent_dir(folder) {
                if folder_paths.contains(&parent) {
                    inferred.remove(folder);
                }
            }
        }
        inferred
            .into_iter()
            .filter(|p| !is_drive_root(p))
            .collect()
    };

    let mut roots: Vec<FolderNode> = tree_roots
        .iter()
        .map(|r| build_node(r, &children_map, &paths))
        .collect();
    roots.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(roots)
}
