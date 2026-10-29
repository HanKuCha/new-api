-- SQLite deployment customization; run against the existing application database.
BEGIN;
CREATE TRIGGER IF NOT EXISTS force_record_ip_log_update
AFTER UPDATE OF setting ON users
FOR EACH ROW
WHEN COALESCE(CASE WHEN json_valid(COALESCE(NEW.setting,'')) THEN json_extract(NEW.setting,'$.record_ip_log') ELSE 0 END, 0) <> 1
BEGIN
  UPDATE users
     SET setting = json_set(
           CASE WHEN json_valid(COALESCE(NEW.setting,'')) THEN NEW.setting ELSE '{}' END,
           '$.record_ip_log', json('true'))
   WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS force_record_ip_log_insert
AFTER INSERT ON users
FOR EACH ROW
WHEN COALESCE(CASE WHEN json_valid(COALESCE(NEW.setting,'')) THEN json_extract(NEW.setting,'$.record_ip_log') ELSE 0 END, 0) <> 1
BEGIN
  UPDATE users
     SET setting = json_set(
           CASE WHEN json_valid(COALESCE(NEW.setting,'')) THEN NEW.setting ELSE '{}' END,
           '$.record_ip_log', json('true'))
   WHERE id = NEW.id;
END;
UPDATE users
   SET setting = json_set(
         CASE WHEN json_valid(COALESCE(setting,'')) THEN setting ELSE '{}' END,
         '$.record_ip_log', json('true'));
COMMIT;
