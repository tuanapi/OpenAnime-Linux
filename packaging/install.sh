#!/bin/bash

# OpenAnime AppImage Installer
# ----------------------------
# Installs the AppImage, Icon, and Desktop Entry for the current user.

APP_NAME="OpenAnime"
ICON_NAME="openanime"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 Installing $APP_NAME..."

# 1. Verify files exist
APP_PATH=""
for d in "$SCRIPT_DIR/../../dist" "$SCRIPT_DIR/../dist" "$SCRIPT_DIR"; do
  if compgen -G "$d/$APP_NAME-*.AppImage" > /dev/null 2>&1; then
    APP_PATH="$(ls -1 "$d/$APP_NAME-"*.AppImage 2>/dev/null | sort -V | tail -n1)"
    break
  fi
done

if [ -z "$APP_PATH" ]; then
    echo "❌ Error: Could not find $APP_NAME-*.AppImage."
    echo "   Checked: ../dist/, ../../dist/, and ./ "
    exit 1
fi

APP_FILENAME="$(basename "$APP_PATH")"
echo "   -> Found $APP_FILENAME"

ICON_PATH=""
if [ -f "$SCRIPT_DIR/../../icon512.png" ]; then
    ICON_PATH="$SCRIPT_DIR/../../icon512.png"
elif [ -f "$SCRIPT_DIR/../icon512.png" ]; then
    ICON_PATH="$SCRIPT_DIR/../icon512.png"
elif [ -f "$SCRIPT_DIR/icon512.png" ]; then
    ICON_PATH="$SCRIPT_DIR/icon512.png"
fi

if [ -z "$ICON_PATH" ]; then
    echo "⚠️ Warning: Icon file not found. Desktop entry might miss the icon."
fi

# 2. Move AppImage to a permanent location
INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"
cp "$APP_PATH" "$INSTALL_DIR/$APP_FILENAME"
chmod +x "$INSTALL_DIR/$APP_FILENAME"
echo "   -> Copied AppImage to $INSTALL_DIR"

# 3. Install Icon
if [ -n "$ICON_PATH" ]; then
    ICON_DEST_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
    mkdir -p "$ICON_DEST_DIR"
    cp "$ICON_PATH" "$ICON_DEST_DIR/$ICON_NAME.png"
    echo "   -> Installed icon to $ICON_DEST_DIR"
    
    # Update cache if command exists
    if command -v gtk-update-icon-cache &>/dev/null; then
        gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" &>/dev/null
    fi
fi

# 4. Create Desktop Entry
DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_DIR/openanime.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
Comment=Stream Anime (WebGPU)
Exec=$INSTALL_DIR/$APP_FILENAME %u
Icon=$ICON_NAME
Terminal=false
Categories=AudioVideo;Video;Player;
StartupWMClass=$APP_NAME
PrefersNonDefaultGPU=true
EOF
chmod +x "$DESKTOP_DIR/openanime.desktop"
echo "   -> Created desktop entry at $DESKTOP_DIR/openanime.desktop"

# Refresh database
update-desktop-database "$DESKTOP_DIR" &>/dev/null

echo "✅ Installation Complete!"
echo "   You can now find '$APP_NAME' in your applications menu."
