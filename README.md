<div align="center">
  <img src="icon512.png" width="120" alt="OpenAnime Linux" />

  # OpenAnime Linux

  OpenAnime için gayriresmi Linux masaüstü istemcisi — WebGPU/Vulkan ile 4K'da kasmadan oynatma.

  [![Top Language](https://img.shields.io/github/languages/top/tuanapi/OpenAnime-Linux)](https://github.com/tuanapi/OpenAnime-Linux)
  [![License](https://img.shields.io/github/license/tuanapi/OpenAnime-Linux)](LICENSE)
  [![Downloads](https://img.shields.io/github/downloads/tuanapi/OpenAnime-Linux/total)](https://github.com/tuanapi/OpenAnime-Linux/releases)
  [![Latest Release](https://img.shields.io/github/v/release/tuanapi/OpenAnime-Linux)](https://github.com/tuanapi/OpenAnime-Linux/releases/latest)
</div>

---

## Özellikler

- **Performans** – WebGPU/Vulkan sayesinde 4K'da akıcı oynatma.
- **Arayüz** – Pencere kenarlığı yok, kontroller fareyle geliyor.
- **Taşınabilir** – Kurulum gerekmez, indir çalıştır.

---

## Kurulum

### AppImage (tüm dağıtımlar)
```bash
chmod +x OpenAnime-*.AppImage
./OpenAnime-*.AppImage
```
İsteğe bağlı: `./install.sh` ile masaüstü entegrasyonu.

### Arch Linux (AUR)
```bash
yay -S openanime-bin     # hazır binary
# veya kaynaktan derle:
yay -S openanime
```

### Debian / Ubuntu
```bash
sudo apt install ./openanime_*.deb
```

### Fedora / RHEL
```bash
sudo rpm -ivh openanime-*.rpm
```

### Nix / NixOS
```bash
nix run github:tuanapi/OpenAnime-Linux
# kalıcı kurulum:
nix profile install github:tuanapi/OpenAnime-Linux
```

---

## Kaynaktan Derleme

```bash
git clone https://github.com/tuanapi/OpenAnime-Linux.git
cd OpenAnime-Linux
npm install
npm start          # geliştirici modu
npm run dist       # paketleri oluştur (AppImage, deb, rpm, pacman, tar.gz)
```

---

## Yapılandırma

Ayarları `~/.config/openanime/config.json` dosyasından düzenleyebilirsiniz.

| Seçenek | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `highPerformance` | `true` | Hibrit sistemlerde ayrık GPU kullan. |
| `discordRPC` | `true` | Discord'da "izliyor" durumunu göster. |
| `useCustomFrame` | `false` | Electron'un Window Controls Overlay'ini kullan. |
| `persistFullscreen` | `false` | Bölüm geçişlerinde tam ekranda kal. |
| `forceWebGPU` | `true` | Sitenin WebGPU ayarını geçersiz kıl. |
| `forceX11` | `otomatik` | X11'i zorla (NVIDIA için `true` olarak ayarlanır). |
| `forcePrimeOffload` | `false` | AMD/Intel hibrit sistemlerde DRI_PRIME zorla. |
| `debugOutlines` | `false` | Tıklanabilir elemanların etrafına kırmızı çerçeve çiz. |
| `titlebar` | `{...}` | Özel başlık çubuğu görünümü. |

---

## Bilinen Sorunlar

- **Tıklama Donması** – Nadiren bölüm geçişlerinde tıklamalar çalışmaz; X11'de koordinat kayması şüphesi. 1.1.6'da NVIDIA dışı GPU'larda native Wayland kullanılır. Karşılaşırsanız [issue açın](https://github.com/tuanapi/OpenAnime-Linux/issues).

---

## Ekran Görüntüleri

| Ana Sayfa | Detay | Keşfet | Oynatıcı |
| :---: | :---: | :---: | :---: |
| ![Ana Sayfa](screenshots/main.png) | ![Detay](screenshots/detail.png) | ![Keşfet](screenshots/discover.png) | ![Oynatıcı](screenshots/player.png) |

---

## Topluluk

Tartışmalar ve destek için [OpenAnime Discord](https://discord.gg/openanime) sunucusuna katılın.
