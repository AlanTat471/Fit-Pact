# Numi resources/

This folder is consumed by `@capacitor/assets` when you run:

```
npx capacitor-assets generate --android
```

That command reads the source files below and writes every Android density
variant of the launcher icon and splash screen into
`android/app/src/main/res/mipmap-*` and `android/app/src/main/res/drawable-*`.

## Files this folder needs

| File                | Purpose                       | Required size       |
| ------------------- | ----------------------------- | ------------------- |
| `icon.png`          | Black legacy icon with centred white Numi wordmark | **1024 × 1024 px** |
| `icon-foreground.png` | Transparent adaptive foreground containing only the white wordmark | 1024 × 1024 |
| `icon-background.png` | Solid black adaptive background | 1024 × 1024 |
| `splash.png`        | Splash screen image (centred logo on plain background) | **2732 × 2732 px** |
| `splash-dark.png`   | (Optional) dark-mode splash | 2732 × 2732 |

If you only provide `icon.png` and `splash.png`, the generator picks sensible
defaults for everything else.

## How to add them

1. Keep the three icon files above together. Do not replace only one layer:
   an opaque coloured foreground over a different background caused the
   brown strip visible in version 25.
2. Splash images are separate. Do not replace them when changing only the
   home-screen icon.
3. From the project root, run:
   ```
   npx capacitor-assets generate --android
   npx cap sync android
   ```
4. Open Android Studio → Build → Generate Signed App Bundle / APK… as usual.

## Notes

- The generator creates **adaptive icons** automatically. On Android 8+
  launchers may render your icon as a circle, square, squircle, or rounded
  square depending on the user's launcher theme. Keep important detail in
  the safe centre 66% of the icon.
- If you want a different background colour, edit `capacitor.config.ts`
  → `plugins.SplashScreen.backgroundColor`.
