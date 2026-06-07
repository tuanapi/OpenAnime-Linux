# OpenAnime Linux

[OpenAnime](https://openani.me) için yapılmış, gayriresmi Linux masaüstü uygulaması.

WebGPU ve Vulkan kullanarak 4K videoları kasma yapmadan oynatır. Modern sistemlerde (Hyprland, KDE 6 vs.) sorunsuz çalışıyor.

### Sürüm 1.1.5 Yenilikleri
- **Akıllı Pencere Konumlandırması:** Uygulama ilk açıldığında pencere artık ekranınıza tam ortalanmış olarak gelir. İşletim sisteminizin çalışma alanı sınırları otomatik olarak tanınır.
- **Dinamik Yapılandırma (Config) Yönetimi:** `config.json` artık çok daha akıllı. Dosyanızdaki eksik ayarlar varsayılanlarla harmanlanarak (merge) tamamlanır ve kırılgan regex yorum satırı silme mantığı kaldırılarak tamamen standart JSON parse işlemine geçildi.
- **Hata Ayıklama (Debug) Modu:** `config.json` içine `titlebar.debug` ayarı eklendi. Özel buton kullanırken tıklanabilir alanları görmek için `true` yapabilirsiniz.
- **Geliştirici Araçları Kısayolu:** Herhangi bir sayfada `Ctrl+Shift+I` ile geliştirici seçeneklerini açabilir, `F5` ile sayfayı yenileyebilirsiniz.

### Bilinen Sorunlar (Known Issues)
- **Tıklama Donması (Click Freeze):** Bölüm geçişlerinde (sonraki bölüme geçerken) bazen uygulamanın tıklamalara yanıt vermediği rapor edilmiştir (fare üzerine gelince hover animasyonları çalışmasına rağmen). Bu durumun Chromium/WebGPU veya site tabanlı bir durum mu olduğu henüz kesinleşmemiştir. Eğer bu durumla karşılaşırsanız, `Ctrl+Shift+I` ile DevTools'u açıp konsoldaki hataları bildirebilir veya `config.json` üzerinden `"debug": true` yaparak gizli katmanların tıklamaları engelleyip engellemediğini test edebilirsiniz.

![OpenAnime](icon512.png)

## Özellikler

*   **Performans:** WebGPU/Vulkan sayesinde 4K oynatma.
*   **Arayüz:** Pencere kenarlığı yok (Frameless). Kontroller sadece fareyi götürünce çıkıyor.
*   **Portable:** Kurulum derdi yok. İndir çalıştır.

## Kurulum

<details>
<summary><strong>Seçenek 1: AppImage (bütün distrolar)</strong></summary>

1.  [Releases](../../releases) sayfasından `.AppImage` dosyasını indirin.
2.  Dosyayı çalıştırılabilir yapın (örn: `chmod +x OpenAnime-1.1.5.AppImage`).
3.  Çalıştırın!

**Sistem Entegrasyonu (Masaüstü Kısayolu & İkon)**:
```bash
chmod +x install.sh
./install.sh
```

**Kaldırma**:
```bash
chmod +x uninstall.sh
./uninstall.sh
```
</details>

<details>
<summary><strong>Seçenek 2: AUR (Arch Linux)</strong></summary>

```bash
yay -S openanime-bin
```

veya kaynaktan derleyin:

```bash
yay -S openanime
```

veya `.pacman` dosyası ile kurun:

```bash
sudo pacman -U openanime-1.1.5.pacman
```
</details>

<details>
<summary><strong>Seçenek 3: Debian/Ubuntu</strong></summary>
  
```bash
sudo apt install ./openanime_1.1.5_amd64.deb
```
</details>

<details>
<summary><strong>Seçenek 4: Fedora</strong></summary>
  
```bash
sudo rpm -ivh openanime-1.1.5.x86_64.rpm
```
</details>

## Ekran Görüntüleri

| Ana Sayfa | Detay Görünümü |
| :---: | :---: |
| ![Ana Sayfa](screenshots/main.png) | ![Detay](screenshots/detail.png) |
| **Keşfet** | **Oynatıcı** |
| ![Keşfet](screenshots/discover.png) | ![Oynatıcı](screenshots/player.png) |

## Kaynaktan Derleme

Gereksinimler: `node`, `npm`.

```bash
git clone https://github.com/tuanapi/OpenAnime-Linux.git
cd OpenAnime-Linux
npm install
npm start          # Geliştirici modu
```
```bash
npm run dist       # AppImage oluştur (dist/ klasörüne)
```

## Yapılandırma (config.json)

Uygulama ayarlarını `~/.config/openanime/config.json` dosyasından manuel olarak düzenleyebilirsiniz. Mevcut tüm seçenekler şunlardır:

| Seçenek | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `highPerformance` | `true` | Hibrit ekran kartlı sistemlerde (NVIDIA/AMD) dGPU kullanımını zorlar. Eski PC'lerde kapatılabilir. |
| `discordRPC` | `true` | Discord'da "ne izliyor" durumunu gösterir. |
| `useCustomFrame` | `false` | Uygulamanın kendi pencere butonlarını (MacOS stili) aktif eder. |
| `persistFullscreen` | `false` | Bölüm geçişlerinde tam ekrandan çıkmamayı sağlar. |
| `isMaximized` | `false` | Uygulamanın tam ekranda başlayıp başlamayacağını belirler. |
| `titlebar` | `{...}` | Özel pencere butonlarının konum ve boyut ayarları. |

## Test Edilen Ortam

*   **OS**: Arch Linux (Kernel 7.0.10-arch1-1) 
*   **DE**: KDE Plasma 6.6.5 (Wayland)
*   **GPU**: NVIDIA GeForce RTX 5070 Ti (nvidia-open-dkms 610.43.02) - *1.1.5 sürümü hibrit (dGPU) ortamında bizzat test edilip doğrulanmıştır.*

## Topluluk
Tartışmalara katılmak için [OpenAnime Discord](https://discord.gg/openanime) sunucusuna katılabilirsiniz.
