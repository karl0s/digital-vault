# The Vault - Concert Archive Browser

A Netflix-style web interface for browsing your private archive of live concert recordings. Built with React and designed for static hosting.

## Features

- **Netflix-Style Dark UI**: Polished, responsive interface with smooth animations
- **Artist Grouping**: Shows organized by artist in horizontal scrollable rows
- **A-Z Navigation**: Quick-jump sidebar to navigate by artist name
- **Real-Time Search**: Filter shows by artist, venue, city, country, date, recording type, setlist, or notes
- **Detailed View**: Right-hand drawer with comprehensive metadata, technical specs, and source information
- **Image Lightbox**: Full-screen image viewer with keyboard navigation
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## Data Format

Place your `shows.json` file in the `/public` directory. The application expects the following structure:

```json
{
  "generated_at": "2025-11-25",
  "items": [
    {
      "ShowID": "unique-id",
      "Artist": "Artist Name",
      "ShowDate": "YYYY-MM-DD",
      "EventOrFestival": "Festival Name (optional)",
      "VenueName": "Venue Name",
      "City": "City",
      "Country": "Country",
      "RecordingType": "Proshot/AUD/SBD (optional)",
      "Generation": "1st Gen/2nd Gen (optional)",
      "Lineage": "Source chain description",
      "SourceEquipment": "Recording equipment (optional)",
      "FolderName": "Folder name (optional)",
      "FolderPath": "/path/to/folder",
      "MasterDriveName": "Drive name",
      "RepVideoFiles": "file1.vob; file2.vob; file3.vob",
      "Container": ".vob",
      "VideoCodec": "mpeg2video",
      "Width": "720",
      "Height": "480",
      "DurationSec": "4460",
      "AspectRatio": "4:3 (native) (optional)",
      "TVStandard": "NTSC/PAL (optional)",
      "AudioCodec": "ac3 (optional)",
      "AudioChannels": "2 (optional)",
      "AudioSampleRate": "48000 (optional)",
      "FileCount": "10",
      "TotalSizeHuman": "2.48 GB",
      "Setlist": "Song 1; Song 2; Song 3",
      "Notes": "Any additional notes or technical details",
      "ImageURLs": ["url1.jpg", "url2.jpg"] // Optional
    }
  ]
}
```

### Required Fields
- `ShowID`, `Artist`, `MasterDriveName`, `FolderPath`, `VideoCodec`, `Width`, `Height`, `Container`, `FileCount`, `TotalSizeHuman`

### Optional Fields
- `ShowDate`, `EventOrFestival`, `RecordingType`, `Generation`, `SourceEquipment`, `AspectRatio`, `TVStandard`, `AudioCodec`, `AudioChannels`, `AudioSampleRate`, `Setlist`, `Notes`, `ImageURLs`

### Notes on Data
- **RepVideoFiles**: Can be a semicolon-separated string or an array
- **ImageURLs**: If not provided, placeholder images will be used
- **ShowDate**: Format YYYY-MM-DD; can be empty for unknown dates
- **DurationSec**: Duration in seconds; will be formatted as hours/minutes

## Deployment

### GitHub Pages
1. Place your `shows.json` file in the `/public` directory
2. Build and deploy to GitHub Pages or any static host
3. The app will automatically load and display your collection

### Local Testing
1. Place `shows.json` in `/public/shows.json`
2. Run the development server
3. Navigate to the application

## Customization

### Adding Images
If you have screenshots or promotional images for your shows:
1. Host the images on a CDN or include them in your static assets
2. Add the URLs to the `ImageURLs` array in your show data
3. Images will appear in the show cards and detail drawer

### Search Behavior
The search feature filters across:
- Artist name
- Venue name
- City and Country
- Show date (year)
- Event/Festival name
- Recording type
- Setlist
- Notes

### Styling
The app uses a Netflix-inspired color scheme:
- Primary background: `#141414`
- Accent color: `#E50914` (Netflix red)
- Card backgrounds: Dark grays with transparency

To customize colors, edit the component files or add CSS variables in `/styles/globals.css`.

## Technical Details

- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Data Loading**: Client-side fetch from static JSON
- **Hosting**: Static files only - no backend required

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled

## Tips for Best Results

1. **Image Quality**: Use 16:9 aspect ratio images at least 800px wide for best card display
2. **Duration**: Provide accurate `DurationSec` values for proper time formatting
3. **Notes**: Technical details from MediaInfo or similar tools work great in the Notes field
4. **Setlist**: Use semicolons to separate songs for automatic numbered list formatting
5. **File Paths**: Use absolute paths for `FolderPath` to help you locate shows on your drives

## License

This is a personal archive browser. Ensure you have rights to any content you catalog.
