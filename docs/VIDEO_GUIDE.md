# Add videos to project cards

YouTube videos are configured in one file:

`assets/data/project-media.json`

Each entry corresponds to one card in the **Research and engineering work** section. Paste a complete YouTube URL into `youtubeUrl`. When that value is blank, the current project illustration remains visible.

## Add or change a video

1. Open `assets/data/project-media.json`.
2. Find the project by its `id`.
3. Paste the YouTube link between the quotation marks after `youtubeUrl`.
4. Save the file and refresh the local website.

Example:

```json
{
  "id": "exoskeleton-control",
  "youtubeUrl": "https://youtu.be/ABCDEFGHIJK"
}
```

Full `youtube.com` links, `youtu.be` links, Shorts links, Live links, embed links, and the 11-character video ID are accepted.

Configured videos replace the illustration and use a 9:16 phone-video frame. On desktop, the vertical video appears on the left and the project title and description appear on the right while the portfolio keeps two cards per row. Narrow screens switch to one card per row, and phones stack the video above its description. Videos load only when the card approaches the screen, start muted, include the normal YouTube controls, and pause after leaving the viewport.

## Remove a video

Set its value back to an empty string:

```json
"youtubeUrl": ""
```

The original project illustration will be used again on the next page load.

## Add a new project card

Give the new `<article class="project-card">` in `index.html` a unique `data-project-id`, then add the same ID to `assets/data/project-media.json`.

Keep each project card focused on one engineering system. Its existing title and description provide the context below the embedded video, so no duplicate video metadata is required in the JSON file.
