# PLATDO V8 — GitHub package

Prepared from `V8.html`. The original file was not modified.

## Included files

```text
index.html
assets/       (116 image, font, audio, and video files)
.nojekyll
README.md
```

## Update your Platdo repository

1. Extract `platdo-v8-github.zip`.
2. In GitHub Desktop, open your `Platdo` repository and choose **Repository → Show in Explorer**.
3. Copy the extracted `index.html`, entire `assets` folder, and `.nojekyll` into the repository root. Replace matching files. You can also copy this README if desired.
4. Commit the changes to the branch used by GitHub Pages, then click **Push origin**.
5. After the Pages deployment completes, open https://spyro0811.github.io/Platdo/ and refresh.

Copy the extracted contents directly into the repository root. Keep `assets` beside `index.html`; do not add an extra enclosing folder.

Use GitHub Desktop or Git for the complete folder. One animated PNG is 42.5 MB. You do not need to upload the ZIP itself.

If Pages already publishes your repository root, keep those settings. If you need to configure it, choose **Settings → Pages → Deploy from a branch**, select your publishing branch and **/ (root)**, then save.

## Local preview

Serve this folder through a local web server. Some audio and animation loaders use `fetch`, which can be blocked when opening `index.html` by double-clicking it. GitHub Pages serves the files through HTTPS.

## Checks performed

- Extracted and deduplicated 116 assets, preserving their original bytes.
- Reduced `index.html` from 148.8 MB to 4.0 MB.
- Updated audio and animation loaders to read the separate assets.
- Verified asset hashes and all 157 asset references.
- Checked JavaScript syntax in all 46 script blocks.
- Full gameplay was not browser-tested.
