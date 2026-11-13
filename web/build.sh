#!/bin/sh
# Builds the browser game from its sources:
#   page.html (title, styles, root element) + logic.js (rules) + ui.js (screen)
# -> tethys.body.html  (published as a claude.ai artifact; no <html>/<head> wrapper)
# -> index.html        (standalone page: open locally or serve with GitHub Pages)
cd "$(dirname "$0")"
{ cat page.html
  printf '\n<script>\n'; cat logic.js; printf '</script>\n<script>\n'; cat ui.js; printf '</script>\n'; } > tethys.body.html
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'
  cat tethys.body.html
  printf '\n</body>\n</html>\n'; } > index.html
