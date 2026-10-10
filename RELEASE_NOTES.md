# Sürüm 1.1.9-2

Bu bir paketleme sürümüdür. Uygulamanın kendisi **1.1.9** ile aynıdır; değişiklik
yalnızca paket imzalama ve depo tarafındadır. Bu yüzden sürüm numarası değil, paket
revizyonu (`-2`) arttı.

## Düzeltilenler

- **RPM paketleri artık GPG ile imzalı.** `dnf`, `gpgcheck=1` ile her paketin
  *kendi* OpenPGP imzasını denetler; imzalı `repomd.xml` paket imzasının yerini
  tutmaz. Paketler daha önce imzasızdı, bu yüzden Fedora kullanıcıları
  `openanime` kurarken `the package is not signed` hatası alıyordu. Artık her
  `.rpm`, depo anahtarıyla imzalanıyor ve sürüme yüklenmeden önce imzası
  doğrulanıyor.

- **Fedora kurulum yönergesi sadeleşti.** Depo tanımındaki imzasız pakiti
  tolere eden `gpgcheck=0` kaldırıldı. Hem depoların üst verisi
  (`repo_gpgcheck=1`) hem paketin kendisi (`gpgcheck=1`) aynı anahtarla
  doğrulanıyor.

## Değişenler

- **Paket revizyonu `2`.** `deb`, `rpm`, `pacman` ve her iki AUR paketi
  `1.1.9-2` olarak yayımlanır. Böylece paketi eski `gpgcheck=0` ayarıyla kurmuş
  Fedora kullanıcıları da `sudo dnf upgrade` ile imzalı pakete geçer.

- **Depo giriş sayfası bağlantıları.** Alt dizinlerdeki "üst dizin" bağlantısı
  artık tek seviye yukarı çıkıyor; bağlantılar göreli. Bu, 1.1.9 etiketinden
  sonra yayımlanan düzeltmenin kalıcı hâlidir.

## Notlar

APT üst verisi (`InRelease`), pacman veritabanı ve paketleri, ayrıca RPM
üst verisi (`repomd.xml`) zaten imzalıydı; bunlara dokunulmadı. Değişen tek
imzalama davranışı, tek tek RPM paketlerinin de imzalanmasıdır.

## İndirme

Biçimler ve kurulum komutları depo kökünde toplanmıştır:
<https://tuanapi.github.io/OpenAnime-Linux>

- **AppImage:** kurulum gerektirmez, tüm dağıtımlarda çalışır.
- **İmzalı depo:** `apt`, `dnf` veya `pacman` ile doğrudan kurulum ve güncelleme.
- **AUR:** `openanime` (kaynaktan derler) ve `openanime-bin` (hazır AppImage).
- **Nix:** `nix run github:tuanapi/OpenAnime-Linux`.
- **Taşınabilir:** `.zip` / `.tar.gz` arşivini açıp `openanime` dosyasını çalıştırın.
