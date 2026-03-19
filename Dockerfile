FROM php:8.2-apache

# Habilita mod_rewrite
RUN a2enmod rewrite

# Copia todos os arquivos para o DocumentRoot do Apache
COPY index.html /var/www/html/index.html
COPY proxy.php  /var/www/html/proxy.php

# Permissões
RUN chown -R www-data:www-data /var/www/html && chmod -R 755 /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
