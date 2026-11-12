#!/bin/sh
# Wraps the artifact body into a standalone page (GitHub Pages / open locally).
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'
  cat tethys.body.html
  printf '\n</body>\n</html>\n'; } > index.html
