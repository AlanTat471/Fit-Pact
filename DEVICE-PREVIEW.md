# How to preview the app on different devices

The app is built to **flow and fit** on phones, tablets, laptops, desktops, and other devices. It uses:

- **Viewport:** `width=device-width, initial-scale=1.0` so mobile browsers don’t zoom out.
- **Tailwind breakpoints:** Layout and spacing change at `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).
- **Responsive layout:** Landing page is one column on small screens, two columns (logo + form) on large; sidebar collapses to icons or a drawer on narrow screens.

You can’t see real device screens from inside Cursor, but you can **preview the app** yourself on each device type using the methods below.

---

## 1. Laptop / desktop / computer (same machine)

**Resize the browser window**

1. Run the app: `npm run dev` and open **http://localhost:8080**.
2. Open the site in **Chrome** (or Edge).
3. **Shrink and widen** the window:
   - **Wide:** You should see logo + login side by side; inside the app, full sidebar + content.
   - **Narrow:** Logo stacks above the form; sidebar becomes a narrow icon bar or a menu you open with a button.

This already shows how it behaves on “laptop” vs “desktop” widths.

---

## 2. Mobile, tablet, iPad (Chrome DevTools)

**Use the built‑in device toolbar** so the browser pretends to be a phone or tablet.

1. With the app open at http://localhost:8080, press **F12** (or right‑click → Inspect) to open DevTools.
2. Click the **device / phone icon** (or press **Ctrl+Shift+M** on Windows, **Cmd+Shift+M** on Mac) to turn on **device toolbar**.
3. At the top, open the **device dropdown** and pick a device:
   - **Mobile:** e.g. iPhone 14, Pixel 7, Samsung Galaxy S20.
   - **Tablet / iPad:** e.g. iPad Air, iPad Pro.
4. The page will **resize and reflow** as it would on that device. Scroll and tap through the app to check:
   - Landing: logo and form stacking, readable text, buttons easy to tap.
   - After login: sidebar as drawer/icon bar, main content full width, no horizontal scroll.

You can also type a **custom size** (e.g. 390×844 for a typical phone) to simulate any screen.

---

## 3. iPad (Safari on Mac, optional)

If you use a Mac:

1. Open the app in **Safari** at http://localhost:8080.
2. Menu **Develop** → **Enter Responsive Design Mode** (or **Develop** → **Responsive Design Mode**).
3. Choose a preset like **iPad** or set a custom size to mimic iPad.

---

## 4. Real phone, tablet, or iPad (same Wi‑Fi)

To see the app on a **real** phone, tablet, or iPad:

1. **Start the dev server** on your computer: `npm run dev`.  
   The app is already set to listen on all interfaces (`host: "::"` in Vite), so other devices on your network can reach it.

2. **Find your computer’s IP address**  
   - Windows: open Command Prompt or PowerShell and run `ipconfig`. Look for **IPv4 Address** under your Wi‑Fi adapter (e.g. 192.168.1.105).  
   - Mac: System Settings → Network → Wi‑Fi → Details, or run `ifconfig` and look for `inet` under your Wi‑Fi interface.

3. On the **phone/tablet/iPad**, open the **browser** (Safari, Chrome, etc.), go to:  
   **http://YOUR_IP:8080**  
   Example: `http://192.168.1.105:8080`.

4. The app will load as it does on a real device. Check:
   - Portrait and landscape.
   - Touch: buttons and links easy to tap, no tiny targets.
   - Sidebar/navigation: opens as a drawer or icon bar and doesn’t cover content badly.

**Note:** Use this only on a trusted home/office Wi‑Fi. Don’t expose this setup to the public internet.

---

## 5. “Any other device”

For **any** device that has a browser:

- **Same device as dev:** Resize the browser (section 1) or use DevTools device toolbar (section 2) and set a custom width/height to match that device’s screen.
- **Real device:** If it’s on the same Wi‑Fi as your computer, use section 4 and open `http://YOUR_IP:8080`.

Tailwind’s breakpoints (`sm`, `md`, `lg`, `xl`) cover a wide range of widths, so the same layout rules apply whether it’s a small phone or a large desktop.

---

## 6. Quick reference: what to check on each “device”

| Device type   | How to preview                         | What to check |
|---------------|----------------------------------------|----------------|
| Desktop       | Full‑screen or large browser window    | Two columns where intended, sidebar expanded, content not too wide. |
| Laptop        | Medium window (e.g. 1280×800)          | Same as desktop; sidebar can collapse to icons. |
| iPad/tablet   | DevTools “iPad” or real iPad           | Layout in portrait/landscape; sidebar as drawer or icons; tap targets. |
| Phone         | DevTools “iPhone”/“Pixel” or real phone| Single column, no horizontal scroll, large tap targets, logo and form stack. |

---

## 7. If something doesn’t fit

- **Text or buttons too small on phone:** We can increase font sizes or padding for `sm:` and `md:`.
- **Sidebar takes too much space on tablet:** Sidebar already collapses; we can tweak the breakpoint or make it overlay on more screen sizes.
- **Landing page cramped on small screens:** We can adjust padding, logo size, or form width for small viewports.

Tell me which device and screen size, and what looks wrong (e.g. “on iPhone the form is cut off”), and we can adjust the layout for that breakpoint.
