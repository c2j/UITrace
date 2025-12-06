# UITrace Browser Extension

A Chrome extension for recording web interactions to create automated test scripts for the UITrace platform.

## Features

- **Event Recording**: Captures clicks, inputs, scrolls, and navigation events
- **Multiple Selector Strategies**: Generates ID, CSS selector, and XPath for each element
- **Visual Feedback**: Highlights elements during recording
- **Screenshot Capture**: Optional screenshots on click events
- **Auto-Wait Commands**: Intelligently adds wait commands between actions
- **Export to JSON**: Export recordings in UITrace-compatible format
- **Desktop Integration**: Connects with the UITrace desktop application

## Installation

### Development Mode

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `browser-extension` directory

### Production

1. Build the extension using the provided build script
2. Upload to the Chrome Web Store

## Usage

### Recording a Session

1. Click the UITrace icon in the Chrome toolbar
2. Click "Start Recording"
3. Interact with the webpage as needed
4. Click "Stop Recording" when done
5. Export the recording or send it to the desktop app

### Settings

Configure the extension by:
1. Right-clicking the UITrace icon and selecting "Options"
2. Adjusting recording settings, selector preferences, and ignore rules

## Data Format

Recorded events are exported in the following JSON format:

```json
{
  "id": "unique-id",
  "name": "Recording Name",
  "url": "https://example.com",
  "started_at": "2024-01-01T00:00:00Z",
  "ended_at": "2024-01-01T00:01:00Z",
  "events": [
    {
      "id": "event-id",
      "timestamp": "2024-01-01T00:00:01Z",
      "event_type": "Click",
      "target": {
        "selector": "#button-id",
        "tag_name": "button",
        "text": "Click me",
        "attributes": {}
      },
      "data": {
        "button": "left",
        "modifiers": []
      }
    }
  ]
}
```

## Architecture

- `manifest.json`: Extension configuration and permissions
- `background.js`: Service worker managing recording state and data
- `content.js`: Injected script to capture DOM events
- `popup.html/js/css`: Extension popup UI
- `options.html/js/css`: Settings and configuration page

## Security

The extension requires minimal permissions:
- `activeTab`: Access to the currently active tab
- `storage`: Local storage for recordings and settings
- `scripting`: Inject content scripts into pages

## Development

To modify the extension:
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the reload button for the extension
4. Test changes immediately

## Troubleshooting

If the extension doesn't work:
1. Check Chrome's developer console for errors
2. Ensure all required permissions are granted
3. Verify the extension is enabled
4. Check if other extensions are conflicting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the UITrace platform and follows the same license terms.