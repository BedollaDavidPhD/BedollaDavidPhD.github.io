# Add videos to the portfolio

The video gallery in the **Research and engineering work** section is controlled by:

`assets/data/videos.json`

You do not need to edit `index.html`.

Videos use YouTube and start automatically with sound disabled when their cards enter the screen. They pause after leaving the screen. Visitors can use the YouTube controls to enable sound.

## Add another YouTube video

1. Open `assets/data/videos.json`.
2. Add a comma after the previous video object.
3. Copy the example below and replace its values.
4. Use only the 11-character YouTube video ID, not the full URL.

For `https://youtu.be/4rHsXWw5kek`, the video ID is `4rHsXWw5kek`.

```json
{
  "youtubeId": "VIDEO_ID_HERE",
  "title": "Short video title",
  "category": "Mobile manipulation",
  "description": "One sentence explaining the system, your contribution, and the result."
}
```

Keep the square brackets around the full list and make sure there is a comma between video objects.

## Recommended description pattern

Use: **system + your contribution + measurable result**

Example:

> Kinova Gen3 and mobile-base control demo showing my 400 Hz ROS 2/C++ whole-body controller and real-time redundancy resolution.
