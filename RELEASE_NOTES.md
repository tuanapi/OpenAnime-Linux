# Sürüm 1.2.0

Bu sürüm AUR paketlerinin (Arch Linux) bağımlılık tanımını düzeltir; uygulamanın
kendisinde davranış değişikliği yoktur. Sürüm revizyonu paketleme düzeltmesiyle
birlikte `1.2.0` olarak yayımlanır.

## Düzeltilenler

- **AUR bağımlılığı düzeltildi: `cups-libs` → `libcups`.** Arch depolarında
  `cups-libs` diye bir paket yoktur — o isim Fedora'ya aittir. Arch'ta CUPS
  kitaplığının paket adı `libcups`'tır. Eski isimle bağımlılık çözülemediği için
  `openanime` ve `openanime-bin` paketleri kurulamıyordu. İki AUR paketinin de
  `PKGBUILD` ve `.SRCINFO` dosyaları `libcups` kullanacak şekilde düzeltildi.

## Notlar

- **RPM imzalama (1.1.9-2'den itibaren) bu sürümde de geçerli.** Her `.rpm`
  paketi depo anahtarıyla imzalanır; Fedora kurulumunda `gpgcheck=1` hem depo
  üst verisini hem paketin kendisini doğrular.
- Paketler `1.2.0-1` olarak imzalanır: `deb`, `rpm`, `pacman` ve AUR
  (`pkgrel=1`).

## İndirme

Biçimler ve kurulum komutları depo kökünde toplanmıştır:
<https://tuanapi.github.io/OpenAnime-Linux>

- **AppImage:** kurulum gerektirmez, tüm dağıtımlarda çalışır.
- **İmzalı depo:** `apt`, `dnf` veya `pacman` ile doğrudan kurulum ve güncelleme.
- **AUR:** `openanime` (kaynaktan derler) ve `openanime-bin` (hazır AppImage).
- **Nix:** `nix run github:tuanapi/OpenAnime-Linux`.
- **Taşınabilir:** `.zip` / `.tar.gz` arşivini açıp `openanime` dosyasını çalıştırın.