FROM php:8.2-apache

# Habilita mod_rewrite
RUN a2enmod rewrite

# Copia TODOS os arquivos para o DocumentRoot do Apache
COPY . /var/www/html/

# Remove o Dockerfile do diretório público
RUN rm -f /var/www/html/Dockerfile

# Permissões de escrita para cache do trigger
RUN chown -R www-data:www-data /var/www/html && chmod -R 755 /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
