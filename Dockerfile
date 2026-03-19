FROM php:8.2-fpm-alpine

# Instala Nginx
RUN apk add --no-cache nginx

# Copia arquivos da aplicação
COPY . /var/www/html/

# Permissões
RUN chown -R www-data:www-data /var/www/html && chmod -R 755 /var/www/html

# Configuração do Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Script de inicialização
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
