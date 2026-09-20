---
name: transmissao-live
description: 'Opera e conserta a transmissão ao vivo das plenárias do Solla (YouTube do Solla e do Júlio + Instagram dos dois) na workstation Pop!_OS: OBS flatpak (perfil Plenaria, canvas vertical Aitum, Multi-RTMP) + relay local mediamtx + kit de scripts em ~/plenaria-cultura-live.'
---

# Transmissão ao vivo (plenárias Solla)

Contexto da arquitetura montada e validada em produção em 2026-09-19 (Plenária da
Cultura). Objetivo: um agente conseguir operar, verificar e consertar o rig sem
redescobrir nada. **O rig vive fora do repo** (`~/plenaria-cultura-live/`);
segredos **só** no `keys.env` (chmod 600, nunca commitar).

## Arquitetura

```
OBS principal (16:9) ── nativo (conta conectada) ─────────► YouTube @JorgeSollaDep
OBS Multi-RTMP (cópia 16:9) ──► relay /live/plenaria ──────► YouTube @juliopinheiro13999
OBS canvas Vertical (9:16) ──► relay /live/vertical ─┬────► Instagram @depjorgesolla
                                                     ├────► Instagram (Júlio)
                                                     └────► YouTube Shorts (opcional: formato duplo)
```

- OBS transmite **direto** para o YouTube do Solla (integração de conta, por
  perfil) — o relay **não** cuida dele (`ENABLE_YT_SOLLA` default 0).
- O vertical é enquadrado **à mão** no canvas do Aitum (não há compositor
  automático quando `ENABLE_IG_COMPOSER=0`, que é o default).
- Relay local (mediamtx, `:1935`) faz fan-out e reconexão por destino com
  supervisores `while true` (retry 3 s; 10 s nas saídas `ig-*`).

## Kit no disco (`~/plenaria-cultura-live/`)

- `bin/mediamtx` (v1.21, relay RTMP) e `bin/ffmpeg` (build estática BtbN; tem
  libx264/aac — **NVENC da CLI falha nesta build**, use x264; o NVENC do OBS
  funciona).
- `assets/`: `espera.png`, `encerramento.png` (16:9, arte oficial da marca),
  `bg-vertical.png` (fundo 1080×1920 usado só pelo compositor legado),
  `logo-solla.png`.
- `gravacao/` (mkv do OBS + mkv vertical do Aitum), `logs/`, `run/` (pids).
- Scripts: `preflight.sh` (chaves+upload+binários), `start.sh`,
  `status.sh`, `restart.sh <yt-solla|yt-julio|yt-vertical|ig-solla|ig-julio|instagram>`, `stop.sh`.
- `ROTEIRO.md` = runbook do dia (checklist, sequência de go-live, troubleshooting).
- `keys.env` (chmod 600): `YT_SOLLA_KEY`, `YT_JULIO_KEY`, `IG_URL`/`IG_KEY`
  (Solla), `IG_JULIO_URL`/`IG_JULIO_KEY`, `YT_SOLLA_VERTICAL_KEY` (opcional,
  formato duplo/Shorts). **Chaves do Instagram são por sessão do Live
  Producer** — expiram; obter novas, colar com aspas simples (têm `&`) e rodar
  `./restart.sh ig-solla` / `ig-julio`.

## OBS (flatpak `com.obsproject.Studio` 32.2.2)

Config em `~/.var/app/com.obsproject.Studio/config/obs-studio/`.

- Perfil **Plenaria** (`basic/profiles/Plenaria/basic.ini`): 1920×1080@30,
  gravação mkv, saída avançada (NVENC CBR ~5000; keyframe 2 s). A auth do
  YouTube (`[YouTube] RefreshToken/Token`) é **por perfil**.
- Coleção **Plenaria** (`basic/scenes/Plenaria.json`): cenas **1 Espera**,
  **2 Plenária** (fonte `Captura de monitor (PipeWire)` com `RestoreToken`
  salvo) e **3 Encerramento**.
- Áudio: **Desktop Audio** (captura do sistema = áudio do Meet), sem mudo e
  **monitoramento desligado** (sem eco); **Mic/Aux DESLIGADO** — as vozes
  entram pelo áudio do Meet. O canvas vertical usa o áudio do canvas principal
  (Desktop Audio está em todas as trilhas).
- Plugins flatpak: **Aitum VerticalCanvas 1.6.4**
  (`plugin_config/vertical-canvas/config.json` — cenas `Cena Vertical`
  (captura) e `Cena Vertical - Espera` (Imagem); saída "Saída 1" →
  `rtmp://127.0.0.1:1935/live/` chave `vertical`) e **MultiRTMP 0.7.4**
  (`basic/profiles/Plenaria/obs-multi-rtmp.json` — destino
  "Youtube - Júlio Pinheiro" → `rtmp://127.0.0.1:1935/live` chave `plenaria`,
  encoder compartilhado, sync start/stop).
- Painel/dock "YouTube Live Control Room" só se registra no arranque com conta
  conectada; já foi intermitente — **não é bloqueador** (monitorar pelo
  YouTube Studio no navegador; usar Chrome, o Studio trava no Zen).

## Pitfalls já vistos em produção

1. **Portal COSMIC sem ScreenCast** → OBS loga `[pipewire] No capture sources
   available`, o seletor de tela não abre e tentativas terminam com
   `Failed to start screencast, denied or cancelled by user`. Fix:
   `systemctl --user restart xdg-desktop-portal` (sobe o backend
   `xdg-desktop-portal-cosmic`) e reativar a fonte no OBS (trocar de cena,
   esconder/mostrar ou remover/readicionar; o `RestoreToken` reconecta sem
   diálogo).
2. **Espaço/borda no campo server/key** do Aitum/Multi-RTMP → o path não casa
   no relay (ex.: `"plenaria "` com espaço, ou `.../live ` sem barra). Formato
   correto: server `rtmp://127.0.0.1:1935/live/` (barra final, sem espaço),
   keys `plenaria`/`vertical` sem espaço. Conferir sempre pelos JSONs acima.
3. **Instagram recusando**: `Input/output error` no open = chave de sessão
   expirada (pegar nova); listras coloridas já apareceram com `-c:v copy` →
   as saídas do IG **reencodam** (libx264 veryfast 4000k, g=60, áudio AAC
   44,1 kHz) e reciclam a cada 10 s.
4. **Orçamento de upload**: somar bitrates dos destinos + Meet ≤ ~2/3 do
   upload medido (`./preflight.sh`; link desta máquina: cabo `enp7s0`,
   ~31–32 Mbps). Config usada: principal 5000, vertical 4000.
5. **Primeira live do canal / 24 h** e transição "Ir ao vivo" que não conclui:
   tentar no Chrome, ligar "Iniciar transmissão automaticamente" no evento; o
   ingest saudável não basta se o canal está restrito.
6. **Nunca reiniciar OBS ao vivo**: para trocar chave ou religar uma saída,
   `./restart.sh <saida>` (as outras não caem); para parar tudo, `./stop.sh`.
7. **Uma instância de OBS** (flatpak); não duplicar.
8. Gravações: OBS grava o horizontal e o Aitum grava o vertical em `gravacao/`
   (`.mkv`); para editar/publicar, remux `-c copy` para `.mp4`.

## Rotina do dia

1. `cd ~/plenaria-cultura-live && ./preflight.sh`
2. Live Producer nas contas → chaves novas no `keys.env` (manter as abas abertas).
3. `./start.sh` → no OBS: Multi RTMP **Start**, iniciar a **saída vertical**,
   cena **1 Espera** → **Iniciar Transmissão + Gravação**.
4. `./status.sh` até `frame=` em `yt-julio`, `ig-solla`, `ig-julio`; **Go live**
   nos dois Instagrans; na hora, cena **2 Plenária**.
5. Encerrar: cena **3 Encerramento** → End live nos IGs → parar OBS → `./stop.sh`.

## Verificação rápida

- `./status.sh`: relay + saídas com `frame=` e quedas estáveis.
- `logs/mediamtx.log`: `is publishing`/`is reading` por path (`live/plenaria`,
  `live/vertical`).
- `logs/yt-julio.log`, `logs/ig-solla.log`, `logs/ig-julio.log`: `frame=` e
  erros de abertura de output.
- Configs: `obs-multi-rtmp.json` e `vertical-canvas/config.json` (destinos).
