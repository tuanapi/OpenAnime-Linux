# OpenAnime paket depoları

Uygulamanın `deb`, `rpm` ve `pacman` paketleri tek bir imzalı depoda yayınlanır.
Kurduktan sonra dağıtımın kendi güncelleme komutu yeni sürümü bulur:

```bash
sudo apt update && sudo apt upgrade     # Debian / Ubuntu
sudo dnf upgrade                        # Fedora
sudo pacman -Syu                        # Arch
```

Uygulama açıkken yeni bir sürüm varsa bir uyarı gösterir ve **Şimdi güncelle**
düğmesi doğrudan yukarıdaki komutları `pkexec` üzerinden çalıştırır.

Depo kökü: <https://tuanapi.github.io/OpenAnime-Linux>

İmza anahtarı parmak izi:

```
F834BFA883FD8148B3D9D44A3DC4F7E104D352CA
```

---

## Debian / Ubuntu

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://tuanapi.github.io/OpenAnime-Linux/openanime-repo.asc \
  | sudo gpg --dearmor -o /etc/apt/keyrings/openanime.gpg
sudo chmod 0644 /etc/apt/keyrings/openanime.gpg

echo 'deb [signed-by=/etc/apt/keyrings/openanime.gpg] https://tuanapi.github.io/OpenAnime-Linux/apt stable main' \
  | sudo tee /etc/apt/sources.list.d/openanime.list

sudo apt update
sudo apt install openanime
```

Kaldırmak için:

```bash
sudo rm -f /etc/apt/sources.list.d/openanime.list
sudo apt update
sudo apt remove openanime
```

## Fedora / RHEL

```bash
sudo tee /etc/yum.repos.d/openanime.repo > /dev/null <<'EOF'
[openanime]
name=OpenAnime
baseurl=https://tuanapi.github.io/OpenAnime-Linux/rpm
enabled=1
gpgcheck=0
repo_gpgcheck=1
gpgkey=https://tuanapi.github.io/OpenAnime-Linux/openanime-repo.asc
EOF

sudo dnf install openanime
```

`gpgkey` adresi ilk kullanımda otomatik indirilip içe aktarılır; onay
istendiğinde `y` demek imzayı güvenilir kılar.

`gpgcheck=0` çünkü tek tek `.rpm` dosyaları imzalı değil. Bütünlük `repomd.xml`
imzasından geliyor: `repomd.xml` → `primary.xml` → paket `sha256` zinciri, yani
`repo_gpgcheck=1` paket içeriğini de kapsıyor.

Kaldırmak için:

```bash
sudo rm -f /etc/yum.repos.d/openanime.repo
sudo dnf remove openanime
```

## Arch Linux

pacman imzasız depoları reddeder ve anahtarı `pacman-key` ile güvenilir
işaretlemeniz gerekir:

```bash
sudo pacman-key --init
curl -fsSL https://tuanapi.github.io/OpenAnime-Linux/openanime-repo.asc -o /tmp/openanime-repo.asc
sudo pacman-key --add /tmp/openanime-repo.asc
sudo pacman-key --finger F834BFA883FD8148B3D9D44A3DC4F7E104D352CA
sudo pacman-key --lsign-key F834BFA883FD8148B3D9D44A3DC4F7E104D352CA

echo -e '\n[openanime]\nServer = https://tuanapi.github.io/OpenAnime-Linux/pacman\nSigLevel = Required DatabaseRequired' \
  | sudo tee -a /etc/pacman.conf

sudo pacman -Sy
sudo pacman -S openanime
```

`--add` tek başına yetmez; `--lsign-key` olmadan pacman
`unknown trust` deyip depoyu reddeder.

Kaldırmak için:

```bash
sudo sed -i '/^\[openanime\]/,+3d' /etc/pacman.conf
sudo pacman -Rns openanime
```

---

## Paket yöneticisi bulunamazsa

Uygulamanın kurulu olduğu ortamı `dpkg-query`, `rpm -q`, `pacman -Qq` ve
`$APPIMAGE` sırayla yoklar. Hiçbiri eşleşmezse sürüm düğmesi depoyu açmaya
düşer. AppImage kurulumlarında `openanime-update` varsa kendi güncellemesini
kullanır.

## Depo içeriği

| Biçim | Yapı | Yolu |
|---|---|---|
| apt | `Packages` + `Release` + `InRelease` | `/apt/dists/stable/` |
| dnf | `repodata/repomd.xml` | `/rpm/repodata/` |
| pacman | `openanime.db` | `/pacman/` |

`apt-ftparchive release` çıktısı sıkıştırılmamış `Packages` girdisini de
listelemek zorundadır; sadece `Packages.zst` listelenirse apt sessizce
görmezden gelir. Betik üçünü de üretip üçünü de `Release` içine yazıyor.