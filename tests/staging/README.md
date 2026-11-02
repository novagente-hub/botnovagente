# NovaBot staging tests: computer per bot

Staging: `docker compose -f docker-compose.staging.yml up -d --no-build` in /opt/novabot-staging
(project novabot-staging, 127.0.0.1:13020, own DB volume, own network, computer namespace novabot-staging).

- `suite.sh` (run on the VPS): headed browser, persistence across restart/recreate, cookie isolation
  between bots, own volumes, 640 MiB cap, namespace separation, agent tools, prod health.
- `chat.py "<message>" out.png` (through a tunnel to 13020): full DeepSeek chat turn in the UI.
- `take.py` / `human.py` / `handback.py`: a person takes control, types in the Bot's browser, hands back.
