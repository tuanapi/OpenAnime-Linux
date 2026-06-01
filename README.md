# OpenAnime Linux

[OpenAnime](https://openani.me) için yapılmış, gayriresmi Linux masaüstü uygulaması.

WebGPU ve Vulkan kullanarak 4K videoları kasma yapmadan oynatır. Modern sistemlerde (Hyprland, KDE 6 vs.) sorunsuz çalışıyor.

### Sürüm 1.1.2 Yenilikleri
- **Klavye Kısayolları Temizliği:** İşletim sistemiyle çakışan ve sorun çıkaran özel klavye kısayolları (F11 ve Escape kontrolcüleri) tamamen kaldırıldı.
- **Pencere Butonları Hizalaması:** Pencere kontrol butonlarının (titlebar) sağ kenar boşluğu `135px` değerine çekilerek görsel yerleşimi iyileştirildi.
- **Önbellek Temizliği Kaldırıldı:** Sorun çıkardığı için otomatik HTTP önbellek (cache) temizleme özelliği tamamen kaldırıldı.


![OpenAnime](icon512.png)

## Özellikler

*   **Performans:** WebGPU/Vulkan sayesinde 4K oynatma.
*   **Arayüz:** Pencere kenarlığı yok (Frameless). Kontroller sadece fareyi götürünce çıkıyor.
*   **Portable:** Kurulum derdi yok. İndir çalıştır.

## Kurulum

<details>
<summary><strong>Seçenek 1: AppImage (bütün distrolar)</strong></summary>

1.  [Releases](../../releases) sayfasından `.AppImage` dosyasını indirin.
2.  Dosyayı çalıştırılabilir yapın (örn: `chmod +x OpenAnime-1.1.2.AppImage`).
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
sudo pacman -U openanime-1.1.2.pacman
```
</details>

<details>
<summary><strong>Seçenek 3: Debian/Ubuntu</strong></summary>
  
```bash
sudo apt install ./openanime_1.1.2_amd64.deb
```
</details>

<details>
<summary><strong>Seçenek 4: Fedora</strong></summary>
  
```bash
sudo rpm -ivh openanime-1.1.2.x86_64.rpm
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
*   **GPU**: NVIDIA GeForce RTX 5070 Ti (nvidia-open-dkms 610.43.02) - *1.1.2 sürümü hibrit (dGPU) ortamında bizzat test edilip doğrulanmıştır.*

## Topluluk
Tartışmalara katılmak için [OpenAnime Discord](https://discord.gg/openanime) sunucusuna katılabilirsiniz.
