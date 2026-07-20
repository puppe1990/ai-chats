use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use std::time::{Duration, Instant};

/// Open a SQLite database read-only via URI, with a short retry on lock contention.
pub fn open_readonly(db_path: &Path) -> rusqlite::Result<Connection> {
    let uri = format!("file:{}?mode=ro", db_path.display());
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI;
    match Connection::open_with_flags(&uri, flags) {
        Ok(c) => Ok(c),
        Err(first) => {
            let deadline = Instant::now() + Duration::from_millis(100);
            while Instant::now() < deadline {
                if let Ok(c) = Connection::open_with_flags(&uri, flags) {
                    return Ok(c);
                }
            }
            Err(first)
        }
    }
}
