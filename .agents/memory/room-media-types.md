---
name: Room media type boundaries
description: Distinguishes chat message media categories from object-storage MIME types.
---

Validate persisted message media types (`image` or `audio`) as categories, and validate the object’s actual `Content-Type` with the MIME allowlist. Do not pass a category string into the MIME-type validator.

**Why:** Conflating these values caused valid room images and voice notes to return 404 despite the message row and stored object both existing.

**How to apply:** When changing room attachment persistence or streaming, check the database category separately from the storage metadata MIME type.
