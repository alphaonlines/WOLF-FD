# Manager Specials Legacy Importer

This folder boxes up the current production Manager Specials upload service so the FD server can move without losing the behavior.

Current live service before rewrite:

- Process: `/usr/bin/python3 /usr/local/bin/fd-manager-specials-upload.py`
- Listener: `127.0.0.1:8000`
- Nginx upload proxy: `/manager-specials-upload` -> `http://127.0.0.1:8000/upload-csv`
- Output root: `/srv/www/wolf.discount/furnituredistributors`
- Image output root: `/srv/www/wolf.discount/furnituredistributors/manager-specials-images`

The checked-in script is a migration bridge, not the final target. Final target is a WOLF-FD Express route plus dashboard module. Keep secrets and uploaded private source spreadsheets out of Git.
