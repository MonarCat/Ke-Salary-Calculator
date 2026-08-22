# Git hooks setup

Enable repository hooks once per clone:

```bash
git config core.hooksPath .githooks
```

This activates the staged-file size guard in `.githooks/pre-commit`.
