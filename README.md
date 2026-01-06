# OpenAnime Linux Client

**OpenAnime** is an unofficial desktop client for [OpenAni.me](https://openani.me), specifically optimized for Linux.

It features hardware acceleration for smooth 4K playback.

### Version 1.0.4
Includes WebGPU, Native Wayland, and Vulkan integration.

![OpenAnime Icon](icon512.png)

## Features

*   **Hardware Acceleration**: Smooth 4K playback powered by WebGPU and Vulkan (Electron 35).
*   **Frameless UI**: Custom window controls that auto-hide for an immersive viewing experience.
*   **Plug & Play**: Single-file AppImage. No installation required.

## Installation

<details>
<summary><strong>Option 1: AppImage (Recommended)</strong></summary>

1.  Download the `.AppImage` file from the [Releases](../../releases) page.
2.  Make it executable (e.g., `OpenAnime-1.0.4.AppImage`).
3.  Run it!

**System Integration (Desktop Shortcut & Icon)**:
```bash
chmod +x install.sh
./install.sh
```

**Uninstall**:
```bash
chmod +x uninstall.sh
./uninstall.sh
```
</details>

<details>
<summary><strong>Option 2: AUR (Arch Linux)</strong></summary>

```bash
yay -S openanime-bin
```
</details>

<details>
<summary><strong>Option 3: Flatpak</strong></summary>

```bash
flatpak install flathub io.github.tuanapi.OpenAnime
```
</details>

## Screenshots

| Main Interface | Detail View |
| :---: | :---: |
| ![Main](screenshots/main.png) | ![Detail](screenshots/detail.png) |
| **Discover** | **Player** |
| ![Discover](screenshots/discover.png) | ![Player](screenshots/player2.png) |

## Build from Source

Requirements: `node`, `npm`.

```bash
git clone https://github.com/tuanapi/OpenAnime-Linux-Desktop-App.git
cd OpenAnime-Linux-Desktop-App
npm install
npm start          # Dev mode
```
```bash
npm run dist       # Build AppImage (in dist/)
```

## Tested Environment

Verified for 4K playback on NVIDIA systems:

*   **OS**: EndeavourOS (Kernel 6.18.2)
*   **DE**: KDE Plasma 6.5.4 (Wayland)
*   **GPU**: NVIDIA GeForce RTX 5070 Ti (Driver: 590.48.01)

## Community
Join the discussion on our [Discord Server](https://discord.gg/openanime).

## License
MIT
