# Publish the browser demo

The repository's main project is Milo. Pages serves the companion demo from `playground/dist/`.

Create a repository named `milo`, then upload the extracted files and folders directly to its root. Include `.github/workflows/pages.yml`; hidden folders may be missed by drag-and-drop upload. You can create that exact path in GitHub's file editor.

## Enable and deploy

1. Open **Settings → Pages**.
2. Set publishing Source to **GitHub Actions**.
3. Open **Actions → Deploy Milo Playground → Run workflow**.

The supplied workflow targets `main`. Change `branches: [main]` if your branch differs. Later pushes deploy automatically.

The workflow checks the entry page and engine files, uploads `playground/dist/`, and deploys. It does not rebuild either engine or run regression tests.

Use GitHub's displayed deployment URL. For a project named `milo`, the usual format is:

```text
https://YOUR-USERNAME.github.io/milo/
```

This is a placeholder. Add your actual deployed URL to the README and repository Website field after success.

## Verify

Run a square, copy a starter, answer a question, try keyboard controls and sound, swap panels, and check downloads/saving after reload.

Keep all of `playground/dist/` together. Relative asset paths support repository subpaths.

A public demo is separate from the private hosted site. A private repository alone is not a guarantee of private demo access. Current `noindex,nofollow` metadata remains unchanged; search indexing is a separate choice.

## References

The setup and action versions follow GitHub documentation checked on 2 November 2026:

- [Publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Verify deployment from the completed GitHub Actions run.
