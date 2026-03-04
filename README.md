# OpenAnime Linux

[OpenAnime](https://openani.me) için yapılmış, unofficial Linux masaüstü uygulaması.

WebGPU ve Vulkan kullanarak 4K videoları kasma yapmadan oynatır. Native Wayland desteği var, yani modern sistemlerde (Hyprland, KDE 6 vs.) sorunsuz çalışıyor.

### Sürüm 1.0.5 Yenilikleri
- **Geri Tuşu:** ESC tuşuna basınca artık önceki sayfaya dönüyor.
- **Altyapı:** Electron 37.10.3 sürümüne güncellendi (En stabil sürüm).

![OpenAnime](icon512.png)

## Özellikler

*   **Performans:** WebGPU/Vulkan sayesinde 4K oynatma.
*   **Arayüz:** Pencere kenarlığı yok (Frameless). Kontroller sadece fareyi götürünce çıkıyor.
*   **Portable:** Kurulum derdi yok. İndir çalıştır.

## Kurulum

<details>
<summary><strong>Seçenek 1: AppImage (Önerilen)</strong></summary>

1.  [Releases](../../releases) sayfasından `.AppImage` dosyasını indirin.
2.  Dosyayı çalıştırılabilir yapın (örn: `OpenAnime-1.0.5.AppImage`).
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
</details>

<details>
<summary><strong>Seçenek 3: Flatpak</strong></summary>

```bash
flatpak install flathub io.github.tuanapi.OpenAnime
```
</details>

## Ekran Görüntüleri

| Ana Sayfa | Detay Görünümü |
| :---: | :---: |
| ![Ana Sayfa](screenshots/main.png) | ![Detay](screenshots/detail.png) |
| **Keşfet** | **Oynatıcı** |
| ![Keşfet](screenshots/discover.png) | ![Oynatıcı](screenshots/player2.png) |

## Kaynaktan Derleme

Gereksinimler: `node`, `npm`.

```bash
git clone https://github.com/tuanapi/OpenAnime-Linux-Desktop-App.git
cd OpenAnime-Linux-Desktop-App
npm install
npm start          # Geliştirici modu
```
```bash
npm run dist       # AppImage oluştur (dist/ klasörüne)
```

## Test Edilen Ortam

*   **OS**: EndeavourOS (Kernel 6.18.2), Arch Linux (Kernel 6.18.13-arch1-1) 
*   **DE**: KDE Plasma 6.5.4-6.6.1 (Wayland)
*   **GPU**: NVIDIA GeForce RTX 5070 Ti (Driver 590.48.01)

## Topluluk
Tartışmalara katılmak için [OpenAnime Discord](https://discord.gg/openanime) sunucusuna katılabilirsiniz.
