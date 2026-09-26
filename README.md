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

- **Performans** – WebGPU sayesinde 4K'da akıcı oynatma.
- **Arayüz** – Özelleştirilebilir pencere kenarlığı.
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
| `highPerformance` | `true` | Hibrit sistemlerde ayrık GPU kullan. `false` yapılırsa PRIME/DRI_PRIME devre dışı kalır (güç tasarrufu). |
| `discordRPC` | `true` | Discord'da "izliyor" durumunu göster. |
| `useCustomFrame` | `false` | Electron'un Window Controls Overlay'ini kullan. |
| `persistFullscreen` | `false` | Bölüm geçişlerinde tam ekranda kal. |
| `forceWebGPU` | `true` | Sitenin WebGPU ayarını geçersiz kıl. |
| `forcePrimeOffload` | `false` | AMD/Intel hibrit sistemlerde DRI_PRIME'ı zorla. |
| `gpuDisplayOverride` | `null` | GPU algılamasını elle ez: `"integrated"` veya `"discrete"`. |
| `debugOutlines` | `false` | Tıklanabilir elemanların etrafına kırmızı çerçeve çiz. |
| `titlebar` | `{...}` | Özel başlık çubuğu görünümü. |

---

## GPU Desteği (WebGPU)

Uygulama, hangi GPU'nun görüntüyü çizdiğini otomatik algılar ve her topolojide
WebGPU'yu ayrık GPU'ya taşır. Algılamayı doğrulamak için:

```bash
OpenAnime --diagnose    # paketli sürüm
npm run diagnose        # kaynak sürüm
```

Çıktıda `webgpu adapter` satırı hangi GPU'nun WebGPU'yu çalıştırdığını, `webgpu fps (load)`
satırı gerçek oynatma tarzı yük altındaki kare hızını gösterir. Sorun bildirirken
`DIAG_JSON=...` satırını issue'ya yapıştırın.

| Topoloji | Yapılan | Neden |
| :--- | :--- | :--- |
| Tek GPU (AMD/Intel/NVIDIA) | Hiçbir şey değiştirilmez | Varsayılan zaten doğru. |
| NVIDIA + iGPU (ekran iGPU'da) | Otomatik X11'e geçiş (XWayland): `__NV_PRIME_RENDER_OFFLOAD`, GLX vendor, `VK_ICD_FILENAMES=nvidia_icd.json`; `--force-high-performance-gpu` + `Vulkan` özelliği | Wayland'de GBM cihazı iGPU'yu, Vulkan NVIDIA'yı kullanır → tek GPU sürecinde iki sürücü (gallium SEGV ile çöker). X11'de GLX offload ile GL de NVIDIA'ya taşınır: tek cihaz, stabil video. |
| NVIDIA + iGPU (ekran NVIDIA'da) | Aynı env değişkenleri, native Wayland | Zaten doğru olan yol bozulmaz; donanım decode çalışır. |
| AMD/Intel + iGPU (ekran iGPU'da) | `DRI_PRIME=1` (+ gerekirse `RADV_DEBUG=nodcc`) | GL tabanlı yolları ayrık GPU'ya yöneltir. |
| NVIDIA + iGPU, ekran hem iGPU hem NVIDIA'da (karışık) | Ekranı süren GPU'ya göre yukarıdaki iki satırdan biri otomatik seçilir | Chromium tek GPU kullanır; seçim monitörün bağlı olduğu GPU'ya göre yapılır. |

Not: `force-high-performance-gpu`, Chromium'un WebGL, WebGPU ve kompozitör için
tek başına seçtiği GPU'yu belirler; `powerPreference` tarayıcıda yok sayılır.
Wayland'de (ekran ayrık GPU'da) ANGLE'nin Vulkan arka ucu kullanılır; X11 yolunda
(NVIDIA + iGPU ekran) `Vulkan` özelliği açıktır, ANGLE varsayılan arka ucu kullanır
(NVIDIA Vulkan ICD yoksa GL arka ucuna düşer).

---

## Bilinen Sorunlar

- **iGPU ekranında kare düşmesi / gecikme** – Monitör iGPU'ya takılıyken (NVIDIA
  hibrit), uygulama otomatik olarak X11 (XWayland) altında çalışır ve GL'i de
  NVIDIA'ya taşır. Hâlâ takılıyorsa `OpenAnime --diagnose` çıktısını ve
  `journalctl -k | grep -i nvidia_drm` (NVIDIA sistemlerinde) çıktısını
  [issue](https://github.com/tuanapi/OpenAnime-Linux/issues) olarak açın.

---

## Ekran Görüntüleri

| Ana Sayfa | Detay | Keşfet | Oynatıcı |
| :---: | :---: | :---: | :---: |
| ![Ana Sayfa](screenshots/main.png) | ![Detay](screenshots/detail.png) | ![Keşfet](screenshots/discover.png) | ![Oynatıcı](screenshots/player.png) |

---

## Topluluk

Tartışmalar ve destek için [OpenAnime Discord](https://discord.gg/openanime) sunucusuna katılın.
Bir sorun ile karşılaşırsanız beni etiketleyebilirsiniz: **@tuanapi**
