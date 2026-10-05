# Sürüm 1.1.9

Bu sürüm uygulamanın davranışını değiştiren bir düzeltmeyi ve paketleme ile depo
altyapısını birlikte getiriyor. Sürüm 1.1.8 ile 1.1.9 arasında bir gün geçmiş
olsa da, değişiklikler birbirinden bağımsız ve tek bir konuda toplanmıyor.

## Düzeltilenler

- **Uygulama açılışta sayfayı iki kez yeniliyordu.** Sayfa yüklenirken bir yenileme
  daha tetikleniyordu; ikinci yükleme de yenileme yaptığı için istek sayısı
  gereğinden fazlaydı. Artık `loadURL` çağrısından hemen sonra **tek ve koşulsuz**
  bir yenileme yapılır. "İnternet var mı" ön kontrolü, `openani.me`'ye bağlanma
  denemesi ve bunun zamanlayıcısı tamamen kaldırıldı; ön kontrol artık yalnızca
  hizmet çalışanının (`serviceWorker.controller`) var olup olmadığını okuyor.
  Sayfa üç kez yüklenemezse gösterilen hata sayfası da aynı sıralamayı kullanıyor.
  Davranış değişikliği: ağ sonradan geri gelirse uygulama artık kendini yeniden
  denemez, hata sayfasında kalır.

- **`deb` ve `rpm` paketleri çalışma zamanı kitaplıklarını beyan etmiyordu.**
  `libasound2t64` (ALSA), `libcups2` (yazdırma) ve `libgbm1` (Mesa) Electron tarafından
  doğrudan yükleniyor ama paket bağımlılıklarında yoktu; dağıtım bunları zaten
  kurmuş olsa bile paket yöneticisi bunları bilmiyordu. Ubuntu 24.04 paket dizini
  karşısında çözümlenerek doğrulandı: bağımlılıklar eklenince çözümleme 177 pakete
  çıkıyor, eski hâliyle bu üç kitaplık hiç getirilmiyordu. `rpm` için karşılıkları
  `alsa-lib`, `cups-libs` ve `mesa-libgbm`; AUR paketlerine de `cups-libs` ve `mesa`
  eklendi.

## Yeni

- **Depo ana sayfası.** İmzalı deponun kökünde
  `https://tuanapi.github.io/OpenAnime-Linux/` adresinde bir giriş sayfası var.
  Paket yöneticinize eklemeniz gereken komutlar, parmak izi ve imza anahtarı
  tek yerde toplanmış durumda; her komut bloğunun üzerine gelince **Kopyala**
  düğmesi beliriyor.

- **Depolarda her dizin gezilebilir.** GitHub Pages dizin listelemesi sunmadığı
  için `apt/`, `rpm/`, `pacman/` ve alt dizinler gezildiğinde 404 dönüyordu. Artık
  her dizin için bir dizin listesi üretiliyor; kök sayfa elle yazılan giriş
  sayfasıyla değiştiriliyor.

- **Depoda çok sürümlü geçmiş.** Daha önce yayımlanmış paketler bir sonraki
  çalışmada havuza katılıp indeksler yeniden üretildiği için geçmiş sürümler
  kurulabiliyor; `apt` ve `dnf` tarafında birden çok sürüm yan yana duruyor.
  `pacman` veritabanı aynı adlı paketin yalnızca en yeni sürümünü tutabildiği
  için orada tek sürüm kalıyor.

- **`deb` paketleri artık tekrarlanabilir.** Aynı commit'ten yapılan iki derleme
  artık birebir aynı sağlama toplamını üretiyor. Zaman damgası `SOURCE_DATE_EPOCH`
  değerinden geliyor, paket günlüğü `packaging/deb-changelog.txt` dosyasından
  okunuyor.

## Altyapı

- **Sürüm çalıştırmaları sıraya giriyor.** Her çalışma aynı `gh-pages` dalını
  yeniden yazdığı için, eşzamanlı iki çalıştırma birbirinin üstüne yazıyordu.
  Artık depo başına tek bir kuyruk var.
- **`electron-builder` artık kendi kendine yayınlamıyor.** Yapılandırılmış bir
  yayın sağlayıcısı olmadığında depo uzak sunucusundan GitHub'ı tahmin edip her
  çalıştırmada, `workflow_dispatch` dâhil, yayın yapıyordu; var olmayan bir etiket
  için yetim taslak sürüm oluşuyordu. Yayınlama kapatıldı, sürüm varlıklarını
  yükleyen adım her koşulda çalışıyor.
- **`latest-linux.yml`** dosyası electron-builder'ın kendisi yerine derlenen
  AppImage'den üretiliyor, böylece dosya ile varlık arasında kayma olamıyor.
- **Nix.** `flake.nix` içindeki Electron sürümü ile `package.json` arasındaki
  uyuşmazlık giderildi ve bağımlılık karma`sı yenilendi. Ayrıca Nix'in Electron
  paketinin WebGPU'yu derlemediği, bu yüzden Nix üzerinden kurulumda WebGPU'nun
  çalışmadığı ve daha eski bir sürümün kurulması gerektiği belgelendi.
- **Küçük düzeltmeler:** `dnf` adımındaki başıboş `</command>` ve kabuk değişkeni
  kaldırıldı, `dnf`'e `-y` eklendi, `gpgkey=` verildi, depo üreticisindeki üç hata
  giderildi, tüm `run:` blokları söz dizimi denetiminden geçirildi.

## 📥 İndirme Seçenekleri

- **AppImage (`.AppImage`):** Tek tıkla çalışır, kurulum gerektirmez. (Tüm Linux dağıtımları için önerilir)
- **İmzalı depo (arch):** `sudo pacman -S openanime` — yukarıdaki giriş sayfasındaki yönergeyi izleyin.
- **Arch Linux (`.pacman`):** Arch Linux, Manjaro, EndeavourOS vb. sistemler için yerel paket.
- **Debian/Ubuntu (`.deb`):** Debian, Ubuntu, Linux Mint, Pop!_OS vb. için kurulum paketi.
- **Fedora/RHEL (`.rpm`):** Fedora, openSUSE, RHEL tabanlı sistemler için kurulum paketi.
- **AUR:** `openanime` kaynaktan derler, `openanime-bin` hazır AppImage kullanır.
- **Nix/NixOS:** `nix run github:tuanapi/OpenAnime-Linux` — ayrı indirme gerekmez, `flake.nix` repoda.
- **Portable (`.zip` / `.tar.gz`):** Arşivi klasöre çıkartın ve doğrudan `openanime` dosyasını çalıştırın.