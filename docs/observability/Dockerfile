FROM grafana/alloy:latest

COPY alloy-config.alloy /etc/alloy/config.alloy

# Alloy HTTP server (health / UI). Fly.toml maps port 8080 → 12345.
EXPOSE 12345

ENTRYPOINT ["/bin/alloy"]
CMD ["run", "/etc/alloy/config.alloy", "--server.http.listen-addr=0.0.0.0:12345"]
