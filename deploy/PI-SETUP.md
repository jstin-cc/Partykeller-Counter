# Betrieb auf dem Raspberry Pi

Ziel: Der Counter läuft als systemd-Dienst, ist im WLAN unter
`http://partykeller.local:3000/` erreichbar, und der angeschlossene
Fernseher zeigt das Scoreboard im Kiosk-Modus.

## 1. Installation

```bash
# Node.js 20+ (z. B. über NodeSource) und git müssen installiert sein
cd /home/pi
git clone <repo-url> partykeller-counter
cd partykeller-counter
npm install --omit=dev

cp .env.example .env
nano .env          # ADMIN_PASSWORD setzen, TOKEN_SECRET: openssl rand -hex 32
```

## 2. systemd-Dienst

```bash
sudo cp deploy/partykeller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now partykeller
systemctl status partykeller     # muss "active (running)" zeigen
```

Logs: `journalctl -u partykeller -f`

## 3. mDNS-Name `partykeller.local`

Raspberry Pi OS bringt avahi mit — es reicht, den Hostnamen zu setzen:

```bash
sudo hostnamectl set-hostname partykeller
sudo systemctl restart avahi-daemon
```

Danach ist der Pi im WLAN als `partykeller.local` erreichbar. Der QR-Code
auf dem Scoreboard zeigt automatisch auf die Adresse, unter der das
Scoreboard geladen wurde — den TV also über
`http://partykeller.local:3000/tv` öffnen, dann stimmt auch der QR-Code
für die Handys.

Hinweis: Android unterstützt mDNS erst ab neueren Versionen zuverlässig.
Falls einzelne Handys `partykeller.local` nicht auflösen, dem Pi im Router
eine feste IP geben — der QR-Code funktioniert unabhängig davon, solange
der TV die erreichbare Adresse benutzt.

## 4. TV im Kiosk-Modus (Chromium)

Für Raspberry Pi OS mit Desktop, Autostart über
`~/.config/wayfire.ini` (Wayland, Bookworm) **oder**
`~/.config/lxsession/LXDE-pi/autostart` (X11):

```
# X11-Variante: Zeile in der autostart-Datei
@chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://partykeller.local:3000/tv
```

```ini
# Wayland-Variante: Abschnitt in wayfire.ini
[autostart]
kiosk = chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://partykeller.local:3000/tv
```

Bildschirmschoner/Standby ausschalten (`raspi-config` → Display Options).

## 5. Backup

Alle Daten liegen in einer Datei: `data/partykeller.db`.
Sichern reicht mit:

```bash
sqlite3 data/partykeller.db ".backup /home/pi/backup-partykeller.db"
```

## 6. Update einspielen

```bash
cd /home/pi/partykeller-counter
git pull
npm install --omit=dev
sudo systemctl restart partykeller
```
