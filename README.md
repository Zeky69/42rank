la config caddy dans mon serveur qui est modifable
dans le serveur il ya pm2 dinstaller si besoin

42rank.codeky.fr {
        reverse_proxy localhost:4266 {
                # Seulement ajouter X-Real-IP car les autres sont automatiques
                header_up X-Real-IP {remote_host}
        }

        log {
                output file /var/log/caddy/rank.codeky.fr.log
                format json
        }

        # HTTPS automatique avec Let's Encrypt
        tls {
                issuer acme
        }
}

