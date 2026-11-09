-- Bổ sung loại file mới nhận diện được (html, json, xml, yaml, log): file đã tải lên trước đó được gán
-- application/octet-stream nên không xem trước được. Cập nhật lại mimeType theo đuôi tên file gốc.
UPDATE `Attachment` SET `mimeType` = 'text/html'
  WHERE `mimeType` = 'application/octet-stream' AND (LOWER(`originalName`) LIKE '%.html' OR LOWER(`originalName`) LIKE '%.htm');
UPDATE `Attachment` SET `mimeType` = 'application/json'
  WHERE `mimeType` = 'application/octet-stream' AND LOWER(`originalName`) LIKE '%.json';
UPDATE `Attachment` SET `mimeType` = 'application/xml'
  WHERE `mimeType` = 'application/octet-stream' AND LOWER(`originalName`) LIKE '%.xml';
UPDATE `Attachment` SET `mimeType` = 'application/yaml'
  WHERE `mimeType` = 'application/octet-stream' AND (LOWER(`originalName`) LIKE '%.yaml' OR LOWER(`originalName`) LIKE '%.yml');
UPDATE `Attachment` SET `mimeType` = 'text/plain'
  WHERE `mimeType` = 'application/octet-stream' AND LOWER(`originalName`) LIKE '%.log';
