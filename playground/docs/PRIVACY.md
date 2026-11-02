# Privacy and saved work

Programs execute locally in a browser worker. The current application does not send source, typed answers, drawings, or saved projects to an application server.

Website files still come from the host. GitHub Pages and browser/network providers handle ordinary website requests under their own policies. Local execution does not mean visiting the demo creates no network traffic.

## Browser storage

Local storage keeps drafts, completed lesson flags, the last workspace, named projects, thumbnails, the project bin, sound preference, and panel order. Other people using the same browser profile may see them.

The application does not deliberately persist typed answers as answer records. However, an answer can appear in a drawing, and a saved thumbnail can retain it.

Storage is tied to the browser profile and origin: protocol, hostname, and port. Moving between the private site, GitHub Pages, and a local server does not transfer work. A private window or another browser can have separate or temporary storage.

Download important programs as `.milo` files and pictures as PNGs. Use **Open a program** to import source elsewhere, then save it as a named project.

There is no cloud synchronization or shared classroom account system. Personal copies of bundled starters stay on the visitor's device.

## Hosting

The included application has no analytics, advertising trackers, or remote runtime fonts. Review these notes when adding integrations.

Clearing site data removes stored work for that origin, not files already downloaded to disk.
