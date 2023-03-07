# Impact
 Online Battleships recreated

## Hosting

Run `_RUN.bat` (Windows) or simply start `app.py` to host the server. By default it will run on port 8471, but this along with other configuration settings can be changed in `config.json`.

## Configuration

| Field name      | Type           | Purpose |
|-----------------|----------------|---------|
| `name`          | `string`       | The name of the application to be shown in the tray (if enabled). |
| `icon`          | `string`       | Filename of the icon to be shown in the tray (if enabled). |
| `port`          | `int`          | The port to host the server on. |
| `production`    | `bool`         | Whether to host on a production server. Uses the `waitress` module. |
| `return_errors` | `bool`         | Whether to return errors from requests to Python files as the response's body. |
| `show_tray`     | `bool`         | Whether to run the application in the tray. Uses the `infi.systray` module. Unfortunately it has to run `taskkill /im python.exe` when closing the application from the tray, so this setting is not recommended. |
| `blacklist`     | `list<string>` | A list of filepaths which will return a 403 (forbidden) error if they are accessed. Used to hide private files. |
