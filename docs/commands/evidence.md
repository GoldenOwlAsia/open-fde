# `fde evidence add`

```bash
fde evidence add <file> [root]
```

Adds a text file (log excerpt, config, meeting notes) to `.fde/evidence/` as
part of the engagement's evidence pack.

- **Automatic redaction**: the content passes through the shared redaction
  rules (AWS keys, private keys, JWTs, bearer/Slack/GitHub tokens,
  connection-string passwords, credential assignments) before it is written.
  Raw secret values are never persisted; the entry records only the *kinds*
  and counts of what was redacted.
- `.fde/evidence/index.json` tracks every entry (file, source path, added-at,
  redaction counts).
- Binary files are refused — redaction can only be guaranteed for text.
- Duplicate names are refused rather than silently overwritten.

```text
Added evidence .fde/evidence/deploy-notes.txt (1× credential-assignment redacted)
```
