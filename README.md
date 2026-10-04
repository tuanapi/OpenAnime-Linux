<div align="center">
  <img src="icon512.png" width="120" alt="OpenAnime Linux" />

  # OpenAnime Linux

  OpenAnime için gayriresmi Linux masaüstü istemcisi — WebGPU etkin, çerçeve
  özelleştirilebilir.

  [![Top Language](https://img.shields.io/github/languages/top/tuanapi/OpenAnime-Linux)](https://github.com/tuanapi/OpenAnime-Linux)
  [![License](https://img.shields.io/github/license/tuanapi/OpenAnime-Linux)](LICENSE)
  [![Downloads](https://img.shields.io/github/downloads/tuanapi/OpenAnime-Linux/total)](https://github.com/tuanapi/OpenAnime-Linux/releases)
  [![Latest Release](https://img.shields.io/github/v/release/tuanapi/OpenAnime-Linux)](https://github.com/tuanapi/OpenAnime-Linux/releases/latest)
</div>

---

## Özellikler

- **WebGPU** – `forceWebGPU` açıkken sitenin WebGPU tercihi geçersiz kılınarak WebGPU
  etkin tutulur.
- **Uygulama içi ayarlar** – Discord RPC ve pencere ayarları, sitenin kendi `/settings`
  sayfasındaki kartlardan yönetilir.
- **Taşınabilir** – AppImage ile kurulum gerekmez, indir çalıştır.
- **Özelleştirilebilir pencere** – kenarlık rengi, yükseklik ve sembol rengi.

Güncel değişiklikler için [Releases](https://github.com/tuanapi/OpenAnime-Linux/releases) sayfasına bakın.

---

## Kurulum

Uygulama `https://openani.me` sitesini açan bir istemcidir; açılış için internet
gerekir.

### AppImage (tüm dağıtımlar)
```bash
chmod +x OpenAnime-*.AppImage
./OpenAnime-*.AppImage
```

AppImage FUSE gerektirir. Ubuntu 23.04 ve üzerinde `libfuse2t64` kurulu değilse
uygulama açılmaz. FUSE olmadan çalıştırmak için:

```bash
./OpenAnime-*.AppImage --appimage-extract-and-run
```

İsteğe bağlı: `./packaging/install.sh` ile masaüstü ve menü entegrasyonu.

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

### Kaldırma

AppImage: dosyayı silin. AUR: `yay -Rns openanime-bin`. deb: `sudo apt remove
openanime`. rpm: `sudo rpm -e openanime`. Nix: `nix profile remove openanime`.
`./packaging/uninstall.sh` AppImage kurulumunu temizler.

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

Discord RPC ve pencere ayarları uygulama içinden, sitenin `/settings` sayfasındaki
kartlardan yönetilir. Aşağıdaki dosya elle düzenleme veya geri yükleme içindir.

`~/.config/openanime/config.json`

Dosya bozulursa silin; uygulama açılışta varsayılanlarla yeniden oluşturur.

| Seçenek | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `discordRPC` | `true` | Discord'da "izliyor" durumunu göster. |
| `rpcVisibility` | `"all"` | `all` = her durumda göster. `watch_only` = yalnızca video oynatılırken göster. |
| `pauseDropMinutes` | `5` | Video duraklatıldıktan kaç dakika sonra Discord durumu temizlensin. |
| `useCustomFrame` | `false` | Electron'un Window Controls Overlay'ini kullan. |
| `persistFullscreen` | `false` | Bölüm geçişlerinde tam ekranda kal. |
| `isMaximized` | `false` | Pencere büyütülmüş açılsın mı. |
| `bounds` | `{...}` | Son pencere konumu ve boyutu. Konum ekranın dışındaysa yeniden ortalanır. |
| `forceWebGPU` | `true` | `true` ise sitenin WebGPU tercihi geçersiz kılınır; `false` ise hiç dokunulmaz. |

Geliştirici ve paketleme seçenekleri — normalde değiştirilmesi gerekmez:

| Seçenek | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `highPerformance` | `true` | Hibrit sistemlerde ayrık GPU kullan. `false` yapılırsa PRIME/DRI_PRIME ayarlanmayabilir. |
| `forcePrimeOffload` | `false` | AMD/Intel hibrit sistemlerde DRI_PRIME'ı zorla. |
| `gpuDisplayOverride` | `null` | GPU algılamasını elle geçersiz kıl: `"integrated"` veya `"discrete"`. |
| `debugOutlines` | `false` | Tıklanabilir öğelerin etrafına kırmızı çerçeve çiz. |
| `titlebar` | `{...}` | Özel başlık çubuğu görünümü. |

---

## GPU Desteği (WebGPU)

Uygulama, görüntüyü hangi GPU'nun işlediğini otomatik algılar ve hibrit sistemlerde
WebGPU'yu ayrık GPU'ya yönlendirir. Algılamayı doğrulamak için:

```bash
./OpenAnime-*.AppImage --diagnose    # AppImage
openanime --diagnose                # paketli kurulum (AUR, deb, rpm)
npm run diagnose                    # kaynak sürüm
```

Çıktıda `webgpu adapter` satırı WebGPU'yu hangi GPU'nun çalıştırdığını, `webgpu fps
(load)` satırı ise sentetik WebGPU yükü altındaki kare hızını gösterir.

---

## Bilinen Sorunlar

- **Uygulama açılmıyor** – AppImage'da FUSE eksikliği en sık neden. Yukarıdaki
  `--appimage-extract-and-run` yöntemini deneyin.
- **Takılma / kare atlama** – Önce yukarıdaki `--diagnose` komutunu çalıştırıp
  `webgpu adapter` satırının doğru GPU'yu gösterdiğini doğrulayın. Hâlâ takılıyorsa
  `DIAG_JSON=...` satırını ve şu çıktıyı
  [issue](https://github.com/tuanapi/OpenAnime-Linux/issues) olarak açın:

  ```bash
  journalctl -k | grep -iE 'nvidia_drm|amdgpu|i915' | tail -20
  ```

---

## Ekran Görüntüleri

| Ana Sayfa | Detay | Keşfet | Oynatıcı |
| :---: | :---: | :---: | :---: |
| ![Ana Sayfa](screenshots/main.png) | ![Detay](screenshots/detail.png) | ![Keşfet](screenshots/discover.png) | ![Oynatıcı](screenshots/player.png) |

---

## Topluluk

Tartışmalar ve destek için [OpenAnime Discord](https://discord.gg/openanime) sunucusuna katılın.
Bir sorun ile karşılaşırsanız beni etiketleyebilirsiniz: **@tuanapi**
