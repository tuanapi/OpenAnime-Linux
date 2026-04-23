#!/bin/bash

# OpenAnime Uninstaller
# ---------------------
# Removes the AppImage, Icon, and Desktop Entry for the current user.

APP_NAME="OpenAnime"
ICON_NAME="openanime"
APP_FILENAME="OpenAnime-1.0.9.AppImage"

echo "🗑️ Uninstalling $APP_NAME..."

# 1. Remove AppImage
INSTALL_DIR="$HOME/.local/bin"
if [ -f "$INSTALL_DIR/$APP_FILENAME" ]; then
    rm -f "$INSTALL_DIR/$APP_FILENAME"
    echo "   -> Removed AppImage from $INSTALL_DIR"
else
    echo "   -> AppImage not found in $INSTALL_DIR (already removed?)"
fi

# 2. Remove Icon
ICON_PATH="$HOME/.local/share/icons/hicolor/512x512/apps/$ICON_NAME.png"
if [ -f "$ICON_PATH" ]; then
    rm -f "$ICON_PATH"
    echo "   -> Removed icon"
    
    # Update cache if command exists
    if command -v gtk-update-icon-cache &>/dev/null; then
        gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" &>/dev/null
    fi
else
    echo "   -> Icon not found (already removed?)"
fi

# 3. Remove Desktop Entry
DESKTOP_PATH="$HOME/.local/share/applications/openanime.desktop"
if [ -f "$DESKTOP_PATH" ]; then
    rm -f "$DESKTOP_PATH"
    echo "   -> Removed desktop entry"
    
    # Refresh database
    update-desktop-database "$HOME/.local/share/applications" &>/dev/null
else
    echo "   -> Desktop entry not found (already removed?)"
fi

# 4. Remove config (optional)
CONFIG_DIR="$HOME/.config/OpenAnime"
if [ -d "$CONFIG_DIR" ]; then
    read -p "   Remove config/cache data? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        rm -rf "$CONFIG_DIR"
        echo "   -> Removed config directory"
    fi
fi

echo "✅ Uninstall Complete!"
