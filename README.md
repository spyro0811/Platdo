# PLATDO — GitHub Pages files

This folder contains the website separated from its embedded media:

- `index.html`: the website, about 3.7 MB.
- `assets/`: 115 image, font, audio, and video files.
- `.nojekyll`: tells GitHub Pages to serve the files directly.

The original HTML file has not been changed. Media files preserve their original bytes, including animated PNG and GIF files. Duplicate media share a single asset file. Sound and animation decoders now load the assets from their relative URLs.

## Upload with GitHub Desktop

One animated PNG is about 42.5 MB, above GitHub's 25 MiB browser-upload limit. Use GitHub Desktop or Git to upload the complete site. All files are below the 100 MiB regular Git limit. Git LFS is not needed and is not supported by GitHub Pages.

1. Extract the ZIP to a folder on your computer.
2. In GitHub Desktop, choose **File → New repository**. Name it `platdo`, choose where to save it, and click **Create repository**.
3. Choose **Repository → Show in Explorer**.
4. Copy the contents of the extracted site folder into the repository folder: `index.html`, `assets`, `.nojekyll`, and this README. Put `index.html` at the repository's top level, not inside an extra `platdo-github` folder.
5. Return to GitHub Desktop. Enter a summary such as `Add PLATDO website` and click **Commit to main**.
6. Click **Publish repository**. For free GitHub Pages hosting, clear **Keep this code private**, then publish.
7. Open the repository on GitHub and choose **Settings → Pages**.
8. Under **Build and deployment**, select **Deploy from a branch**, select **main** and **/ (root)**, then click **Save**.
9. After deployment finishes, Pages settings will show your site link, normally `https://YOUR-USERNAME.github.io/platdo/`.

Upload the extracted contents, not the ZIP itself. Keep the `assets` folder alongside `index.html`; the links also work when the site is published under a repository subfolder.

## Previewing locally

Use a local web server to preview the site. Opening `index.html` directly by double-clicking can prevent browsers from loading the sound and animation decoder files. An editor's local server feature is sufficient. If Python is installed, you can run `python -m http.server 8000` from this folder and open `http://localhost:8000/`.

## Verification

All 156 extracted asset references were checked against their files. Each of the 115 unique files was verified byte-for-byte against its original embedded content. All 41 JavaScript blocks passed syntax checks. Complete gameplay was not tested in a browser.

GitHub documentation: [file size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), [Pages publishing settings](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
