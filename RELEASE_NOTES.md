# Sürüm 1.1.8

## Yeni

**Uygulama içi ayar kartları.** Discord RPC ve Pencere ayarları artık sitenin kendi
`/settings` sayfasında, sitenin gerçek Expander bileşenine bağlanan iki kart olarak
görünür. Kartlar yerel site kartlarıyla aynı şekilde açılır, animasyonu ve klavye
davranışıdır.

- **Discord RPC** – aç/kapa, **RPC Görünürlüğü** (`Herşey` / `İzlenen`), **Zaman Aşımı**
  (1–60 dk).
- **Pencere** – **Özel Pencere Çerçevesi**, **Tam Ekranı Koru**, **Açılışta Pencereyi Büyüt**.

**Discord oynatıyor rozetleri.** Oynatıyor / duraklatıldı durumları kendi ikonlarını
kullanır.

**Zaman aşımı ayarı.** `pauseDropMinutes` ile duraklatıldıktan kaç dakika sonra Discord
durumunun temizleneceği belirlenebilir.

**Hata sayfası.** Sayfa üç kez yüklenemezse boş pencere yerine ne olduğunu söyleyen
bir hata sayfası gösterilir.

## Düzeltilenler

- **Ağ kontrolü yanlış adrese gidiyordu.** "İnternet var mı" testi `1.1.1.1:443`
  (Cloudflare) ile kuruluyordu; o adres engellendiğinde test başarısız dönüyor ve eski
  sayfayı yenileme hiç çalışmıyordu. Artık `openani.me` kullanılıyor.
- **Kayıtlı pencere konumu geçersiz kalınca uygulama görünmez açılıyordu.** Monitörü
  değiştirince ya da çözünürlüğü oynatınca eski konum olduğu gibi kullanılıyordu.
  Konum ve boyut artık bağlı bulunduğu ekrana sığdırılıyor; sığmıyorsa pencere
  ortalanıyor.
- **Pencereler sandbox'sız çalışıyordu.** Ana ve alt pencere artık `sandbox: true` ile
  açılıyor.
- **`get-config` config.json'daki her anahtarı renderer'a veriyordu.** Okuma listesiyle
  sınırlandı.
- **WebGPU tercihi her açılışta sitenin kendi ayarını eziyordu.** `settings.useWebGPU`
  koşulu sorulmadan yazılıyordu; artık yalnızca anahtar yoksa yazılıyor, sitenin
  tercihi varsa dokunulmuyor.
- **config.json yazımı atomik değildi.** Yazma sırasında bir çökme dosyayı kırpıyordu.
  Artık `config.json.tmp` üzerine yazılıp `rename` ile yerine konuyor, kapanışta da
  boşaltılıyor.
- **X11'e geçişte ebeveyn süreç uygulama boyunca yanıp duruyordu.** Artık 3 saniyelik
  el sıkışmanın ardından çıkıyor.
- **Paket bağımlılıklarında `libxkbcommon` eksikti.** Electron `libxkbcommon`'u doğrudan
  bağlıyor; bu kütüphane `deb` / `rpm` / `pacman` ve kaynak AUR paketinde bağımlılık
  olarak tanımlı değildi. `-bin` AUR paketinde ayrıca `libxkbfile` ve `libxtst` de
  eksikti. Üçü de artık tüm paketlerde tanımlı.

## Bakım

- Electron 44.5.1, `@xhayper/discord-rpc` 1.5.1.
- Paketlenmiş ekran görüntüleri (`screenshots/`) dağıtım paketlerine dahil edilmiyor.

## 📥 İndirme Seçenekleri

- **AppImage (`.AppImage`):** Tek tıkla çalışır, kurulum gerektirmez. (Tüm Linux dağıtımları için önerilir)
- **Arch Linux (`.pacman`):** Arch Linux, Manjaro, EndeavourOS vb. sistemler için yerel paket.
- **Debian/Ubuntu (`.deb`):** Debian, Ubuntu, Linux Mint, Pop!_OS vb. için kurulum paketi.
- **Fedora/RHEL (`.rpm`):** Fedora, openSUSE, RHEL tabanlı sistemler için kurulum paketi.
- **Nix/NixOS:** `nix run github:tuanapi/OpenAnime-Linux` — ayrı indirme gerekmez, `flake.nix` repoda.
- **Portable (`.zip` / `.tar.gz`):** Arşivi klasöre çıkartın ve doğrudan `openanime` dosyasını çalıştırın.