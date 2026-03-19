#!/bin/sh
# Inicia PHP-FPM em background
php-fpm -D
# Inicia Nginx em foreground
nginx -g "daemon off;"
